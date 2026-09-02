import type { AgentDefinition, InstallMethod } from '../agents'
import type { InstalledAgentState } from '../state'
import type { LifecycleObservation, LifecycleOutcome, LifecyclePostcondition } from './model'
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
import { planLifecycleMutation } from './mutation-planner'
import { observeLifecycleProvider, resolveStateProviderBinding } from './provider-evidence'
import { reconcileVerifiedMutation, type VerifiedMutation } from './reconcile'

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
