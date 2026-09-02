import type { AgentDefinition, InstallMethod } from '../agents'
import type { InstalledAgentState } from '../state'
import type {
  LifecycleIntent,
  LifecycleObservation,
  LifecycleOutcome,
  LifecyclePlan,
  LifecyclePlanningProvider,
  LifecyclePostcondition,
  LifecycleStep,
} from './model'
import { getCliContext } from '../cli-context'
import {
  buildInstalledAgentState,
  installAgentOutcome,
  reinstallInstalledAgentOutcome,
  rollbackInstalledAgentInstallation,
  withAgentLifecycleLock,
} from '../package-manager'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { setAgentLifecycleEvidence } from '../state'
import { isBinaryInPath } from '../utils/detect'
import { resolveStateProviderBinding } from './provider-binding'
import { observeLifecycleProvider, reconcileVerifiedMutation, type VerifiedMutation } from './reconcile'

export type AgentInstallationRoute = 'adopt' | 'install' | 'satisfied'

export interface AgentInstallationExecutionValue {
  readonly installedState: InstalledAgentState
}

export interface AgentInstallationObservation {
  readonly inPath: boolean
  readonly installedState?: InstalledAgentState
  readonly lifecycle: LifecycleObservation
  readonly methods: readonly InstallMethod[]
}

export interface ReconcileAgentInstallationInput {
  readonly adoptableMethod?: InstallMethod
  readonly agent: AgentDefinition
  readonly observation: AgentInstallationObservation
  readonly operation: 'ensure' | 'install'
  readonly route: AgentInstallationRoute
}

export function reconcileAgentInstallation(
  input: ReconcileAgentInstallationInput,
): Promise<LifecycleOutcome<VerifiedMutation<AgentInstallationExecutionValue>>> {
  const { adoptableMethod, agent, observation, operation, route } = input
  const installMethod = observation.installedState ? undefined : observation.methods[0]
  const source = observation.installedState ?? adoptableMethod ?? installMethod
  const planningObservation = createInstallationObservation(observation.lifecycle, agent, adoptableMethod)
  const planned = planLifecycleMutation({
    intent: { kind: operation, targetId: agent.name },
    observation: planningObservation,
    providerId: getProviderId(source),
    providerTargetId: getProviderTargetId(agent, source),
  })

  if (planned.decision !== route) {
    return Promise.resolve({ kind: 'indeterminate', reason: `planned-${planned.decision}-cannot-execute-${route}` })
  }

  return withAgentLifecycleLock(async () => {
    if (route === 'install' && observation.installedState && !observation.inPath) {
      const binding = resolveStateProviderBinding(agent, observation.installedState)
      if (!binding) return { kind: 'indeterminate', reason: 'tracked-provider-binding-unresolved' }
      const provider = await withLifecycleProviderContext(context => observeLifecycleProvider(binding, context))
      if (provider.kind !== 'success' || provider.value.kind !== 'absent') {
        return { kind: 'indeterminate', reason: 'tracked-provider-not-conclusively-absent' }
      }
    }

    return reconcileVerifiedMutation({
      createReceipt: (verification, execution) => {
        const binding = resolveStateProviderBinding(agent, execution.value.installedState)
        if (!binding) throw new Error(`Cannot resolve provider binding for ${agent.name}.`)
        const verifiedObservation = verification.observation.kind === 'present' ? verification.observation : undefined
        return {
          ...(binding.target.binaryName ? { executableName: binding.target.binaryName } : {}),
          kind: 'lifecycle-receipt',
          providerId: binding.providerId,
          providerTargetId: binding.target.id,
          providerTargetKind: binding.target.kind,
          schemaVersion: 1,
          targetId: agent.name,
          verifiedAt: new Date().toISOString(),
          ...(verifiedObservation?.executablePath ? { executablePath: verifiedObservation.executablePath } : {}),
          ...(verifiedObservation?.version ? { version: verifiedObservation.version } : {}),
        }
      },
      compensate: execution =>
        route === 'install'
          ? rollbackInstalledAgentInstallation(agent, execution.value.installedState)
          : Promise.resolve(),
      execute: async () =>
        executeInstallationRoute(agent, route, observation.installedState, adoptableMethod, installMethod),
      plan: planned.plan,
      recordReceipt: (receipt, execution) => setAgentLifecycleEvidence(execution.value.installedState, receipt),
      verify: async execution =>
        verifyInstallationPostcondition(
          agent,
          execution.value.installedState,
          operation,
          planned.plan.steps[0]?.postconditions[0],
        ),
    })
  })
}

async function executeInstallationRoute(
  agent: AgentDefinition,
  route: AgentInstallationRoute,
  installedState: InstalledAgentState | undefined,
  adoptableMethod: InstallMethod | undefined,
  installMethod: InstallMethod | undefined,
) {
  if (route === 'satisfied' && installedState) {
    return { kind: 'success' as const, value: { changed: false, value: { installedState } } }
  }
  if (route === 'adopt' && adoptableMethod) {
    if (getCliContext().cancelled) return { kind: 'cancelled' as const, reason: 'tracking-cancelled' }
    return {
      kind: 'success' as const,
      value: { changed: true, value: { installedState: buildInstalledAgentState(agent, adoptableMethod) } },
    }
  }

  if (route === 'install' && installedState) {
    const reinstalled = await reinstallInstalledAgentOutcome(agent, installedState)
    return reinstalled.kind === 'success' && reinstalled.value.installedState
      ? {
          kind: 'success' as const,
          value: { changed: true, value: { installedState: reinstalled.value.installedState } },
        }
      : reinstalled.kind === 'success'
        ? { kind: 'failed' as const, reason: 'installed-state-missing', retryable: false }
        : reinstalled
  }

  if (!installMethod) return { kind: 'indeterminate' as const, reason: 'install-method-unresolved' }
  const installed = await installAgentOutcome(agent, [installMethod])
  if (installed.kind !== 'success') return installed
  if (!installed.value.installedState) {
    return { kind: 'failed' as const, reason: 'installed-state-missing', retryable: false }
  }
  return {
    kind: 'success' as const,
    value: { changed: true, value: { installedState: installed.value.installedState } },
  }
}

async function verifyInstallationPostcondition(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
  operation: 'ensure' | 'install',
  planned?: LifecyclePostcondition,
) {
  const postcondition: LifecyclePostcondition = planned ?? {
    executable: agent.binaryName,
    kind: 'executable-present',
  }
  const binding = resolveStateProviderBinding(agent, installedState)
  if (!binding) {
    return {
      kind: 'indeterminate',
      postcondition,
      reason: `provider-binding-unresolved-after-${operation}`,
    } as const
  }

  const [binaryPresent, providerOutcome] = await withLifecycleProviderContext(context =>
    Promise.all([isBinaryInPath(agent.binaryName, context), observeLifecycleProvider(binding, context)]),
  )
  const providerPresent = providerOutcome.kind === 'success' && providerOutcome.value.kind === 'present'
  const providerObservation = providerOutcome.kind === 'success' ? providerOutcome.value : undefined
  const observation: LifecycleObservation =
    binaryPresent && providerPresent
      ? {
          drift: { kind: 'none' },
          executablePath: providerObservation?.kind === 'present' ? providerObservation.executablePath : undefined,
          kind: 'present',
          providerId: binding.providerId,
          providerTargetId: binding.target.id,
          targetId: agent.name,
          version: providerObservation?.kind === 'present' ? providerObservation.version : undefined,
        }
      : { drift: { kind: 'recorded-absent' }, kind: 'absent', targetId: agent.name }

  return binaryPresent && providerPresent
    ? ({ kind: 'satisfied', observation, postcondition } as const)
    : ({
        kind: 'unsatisfied',
        observation,
        postcondition,
        reason: !binaryPresent
          ? `binary-not-found-after-${operation}`
          : `provider-target-not-present-after-${operation}`,
      } as const)
}

async function withLifecycleProviderContext<T>(
  invoke: (context: import('../providers').ProviderOperationContext) => Promise<T>,
): Promise<T> {
  const operation = createCliOperationContext()
  try {
    return await invoke(operation.context)
  } finally {
    operation.dispose()
  }
}

function createInstallationObservation(
  observation: LifecycleObservation,
  agent: AgentDefinition,
  adoptableMethod: InstallMethod | undefined,
): LifecycleObservation {
  if (observation.kind !== 'present' || !adoptableMethod) return observation
  return {
    ...observation,
    providerId: getProviderId(adoptableMethod),
    providerTargetId: getProviderTargetId(agent, adoptableMethod),
  }
}

function getProviderId(source: InstalledAgentState | InstallMethod | undefined): string | undefined {
  if (!source) return undefined
  return 'installType' in source ? source.installType : source.type
}

function getProviderTargetId(agent: AgentDefinition, source: InstalledAgentState | InstallMethod | undefined): string {
  if (source) {
    if (source.packageName) return source.packageName
    if (source.command) return source.command
    if (source.binaryName) return source.binaryName
    const providerId = getProviderId(source)
    if (providerId === 'bun' || providerId === 'npm') return agent.packages?.npm ?? agent.binaryName
    if (providerId === 'cargo') return agent.packages?.cargo ?? agent.binaryName
    if (providerId === 'deno') return agent.packages?.deno ?? agent.binaryName
    if (providerId === 'mise') return agent.packages?.mise ?? agent.binaryName
    if (providerId === 'pip') return agent.packages?.pip ?? agent.binaryName
    if (providerId === 'uv') return agent.packages?.uv ?? agent.binaryName
  }
  return agent.binaryName
}

export type LifecycleMutationDecision =
  | 'adopt'
  | 'blocked'
  | 'clear-ghost'
  | 'install'
  | 'preserve-unmanaged'
  | 'satisfied'
  | 'unsupported'
  | 'uninstall'

export interface LifecycleMutationPlanningInput {
  readonly intent: LifecycleIntent
  readonly observation: LifecycleObservation
  readonly provider?: LifecyclePlanningProvider
  /** Compatibility fields for the already-migrated Phase 6 mutation paths. */
  readonly providerId?: string
  readonly providerTargetId?: string
}

export interface LifecycleMutationPlanningResult {
  readonly decision: LifecycleMutationDecision
  readonly plan: LifecyclePlan
}

export function planLifecycleMutation(input: LifecycleMutationPlanningInput): LifecycleMutationPlanningResult {
  const decision = decideMutation(input)
  const plan: LifecyclePlan = {
    id: `${input.intent.kind}-${input.intent.targetId}`,
    intent: input.intent,
    kind: 'lifecycle-plan',
    observation: input.observation,
    steps: createSteps(decision, input),
  }

  return { decision, plan }
}

function decideMutation(input: LifecycleMutationPlanningInput): LifecycleMutationDecision {
  const { intent, observation } = input

  if (observation.kind === 'indeterminate' || observation.drift.kind === 'indeterminate') return 'blocked'
  if (observation.drift.kind === 'conflicting-source') return 'blocked'
  if (providerContextConflicts(input)) return 'blocked'

  if (intent.kind === 'uninstall') {
    if (observation.kind === 'absent') {
      return observation.drift.kind === 'recorded-absent' ? 'clear-ghost' : 'preserve-unmanaged'
    }
    if (!observation.providerId || !resolveMutationProviderTargetId(input)) return 'preserve-unmanaged'
    return supports(input, 'uninstall') ? 'uninstall' : 'unsupported'
  }

  if (observation.kind === 'present') {
    if (observation.drift.kind === 'untracked') {
      return observation.providerId ? 'adopt' : 'preserve-unmanaged'
    }
    return 'satisfied'
  }

  if (!resolveMutationProviderId(input) || !resolveMutationProviderTargetId(input)) return 'blocked'
  return supports(input, 'install') ? 'install' : 'unsupported'
}

function providerContextConflicts(input: LifecycleMutationPlanningInput): boolean {
  const { observation, provider } = input
  if (observation.kind !== 'present' || provider === undefined) return false

  return (
    (observation.providerId !== undefined && observation.providerId !== provider.providerId) ||
    (observation.providerTargetId !== undefined && observation.providerTargetId !== provider.targetId) ||
    (observation.providerTargetKind !== undefined && observation.providerTargetKind !== provider.targetKind)
  )
}

function supports(input: LifecycleMutationPlanningInput, operation: 'install' | 'uninstall'): boolean {
  return input.provider === undefined || input.provider.capabilities.includes(operation)
}

function createSteps(
  decision: LifecycleMutationDecision,
  input: LifecycleMutationPlanningInput,
): readonly LifecycleStep[] {
  switch (decision) {
    case 'install':
      return [providerMutationStep('install', input, packagePostcondition('package-present', input))]
    case 'uninstall':
      return [providerMutationStep('uninstall', input, packagePostcondition('package-absent', input))]
    case 'adopt':
      return [
        operationStep(`adopt-${input.intent.targetId}`, [
          {
            executable:
              input.observation.kind === 'present'
                ? (input.observation.executablePath ?? input.intent.targetId)
                : input.intent.targetId,
            kind: 'executable-present',
          },
        ]),
      ]
    case 'clear-ghost':
      return [operationStep(`clear-ghost-${input.intent.targetId}`, [])]
    case 'blocked':
    case 'preserve-unmanaged':
    case 'satisfied':
    case 'unsupported':
      return []
  }
}

function providerMutationStep(
  operation: 'install' | 'uninstall',
  input: LifecycleMutationPlanningInput,
  postcondition: LifecyclePostcondition,
): LifecycleStep {
  const resolvedProviderId = resolveMutationProviderId(input)!
  const resolvedProviderTargetId = resolveMutationProviderTargetId(input)!

  return {
    dependsOn: [],
    effects: [
      {
        capability: `${resolvedProviderId}-${operation}`,
        kind: 'provider-mutation',
        providerId: resolvedProviderId,
        targetId: resolvedProviderTargetId,
      },
    ],
    id: `${operation}-${input.intent.targetId}`,
    kind: 'operation',
    postconditions: [postcondition],
    preconditions: [],
  }
}

function packagePostcondition(
  kind: 'package-absent' | 'package-present',
  input: LifecycleMutationPlanningInput,
): LifecyclePostcondition {
  return {
    kind,
    providerId: resolveMutationProviderId(input)!,
    targetId: resolveMutationProviderTargetId(input)!,
  }
}

function resolveMutationProviderId(input: LifecycleMutationPlanningInput): string | undefined {
  return input.observation.kind === 'present'
    ? (input.observation.providerId ?? input.provider?.providerId ?? input.providerId)
    : (input.provider?.providerId ?? input.providerId)
}

function resolveMutationProviderTargetId(input: LifecycleMutationPlanningInput): string | undefined {
  return input.observation.kind === 'present'
    ? (input.observation.providerTargetId ?? input.provider?.targetId ?? input.providerTargetId)
    : (input.provider?.targetId ?? input.providerTargetId)
}

function operationStep(id: string, postconditions: readonly LifecyclePostcondition[]): LifecycleStep {
  return {
    dependsOn: [],
    effects: [],
    id,
    kind: 'operation',
    postconditions,
    preconditions: [],
  }
}
