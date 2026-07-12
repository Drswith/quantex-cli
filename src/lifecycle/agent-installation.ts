import type { AgentDefinition, InstallMethod } from '../agents'
import type { AgentInspection } from '../inspection'
import type { InstalledAgentState } from '../state'
import type { LifecycleObservation, LifecycleOutcome, LifecyclePostcondition } from './model'
import { getCliContext } from '../cli-context'
import { installAgent, reinstallInstalledAgent, trackInstalledAgent, withAgentLifecycleLock } from '../package-manager'
import { setLifecycleReceipt } from '../state'
import { isBinaryInPath } from '../utils/detect'
import { planLifecycleMutation } from './mutation-planner'
import { observeLifecycleProvider, resolveStateProviderBinding } from './provider-evidence'
import { reconcileVerifiedMutation, type VerifiedMutation } from './reconcile'

export type AgentInstallationRoute = 'adopt' | 'install' | 'satisfied'

export interface AgentInstallationExecutionValue {
  readonly installedState: InstalledAgentState
}

export interface ReconcileAgentInstallationInput {
  readonly adoptableMethod?: InstallMethod
  readonly agent: AgentDefinition
  readonly inspection: AgentInspection
  readonly operation: 'ensure' | 'install'
  readonly route: AgentInstallationRoute
}

export function reconcileAgentInstallation(
  input: ReconcileAgentInstallationInput,
): Promise<LifecycleOutcome<VerifiedMutation<AgentInstallationExecutionValue>>> {
  const { adoptableMethod, agent, inspection, operation, route } = input
  const source = inspection.installedState ?? adoptableMethod ?? inspection.methods[0]
  const planned = planLifecycleMutation({
    intent: { kind: operation, targetId: agent.name },
    observation: createInstallationObservation(agent, inspection.inPath, inspection.installedState, adoptableMethod),
    providerId: getProviderId(source),
    providerTargetId: getProviderTargetId(agent, source),
  })

  return withAgentLifecycleLock(async () => {
    if (route === 'install' && inspection.installedState && !inspection.inPath) {
      const binding = resolveStateProviderBinding(agent, inspection.installedState)
      if (!binding) return { kind: 'indeterminate', reason: 'tracked-provider-binding-unresolved' }
      const context = getCliContext()
      const controller = new AbortController()
      if (context.cancelled) controller.abort('cli-cancelled')
      const provider = await observeLifecycleProvider(binding, {
        signal: controller.signal,
        timeoutMs: context.timeoutMs,
      })
      if (provider.kind !== 'success' || provider.value.kind !== 'absent') {
        return { kind: 'indeterminate', reason: 'tracked-provider-not-conclusively-absent' }
      }
    }

    return reconcileVerifiedMutation({
      createReceipt: (verification, execution) => {
        const binding = resolveStateProviderBinding(agent, execution.value.installedState)
        if (!binding) throw new Error(`Cannot resolve provider binding for ${agent.name}.`)
        const observation = verification.observation.kind === 'present' ? verification.observation : undefined
        return {
          ...(binding.target.binaryName ? { executableName: binding.target.binaryName } : {}),
          kind: 'lifecycle-receipt',
          providerId: binding.providerId,
          providerTargetId: binding.target.id,
          providerTargetKind: binding.target.kind,
          schemaVersion: 1,
          targetId: agent.name,
          verifiedAt: new Date().toISOString(),
          ...(observation?.executablePath ? { executablePath: observation.executablePath } : {}),
          ...(observation?.version ? { version: observation.version } : {}),
        }
      },
      execute: async () => executeInstallationRoute(agent, route, inspection.installedState, adoptableMethod),
      plan: planned.plan,
      recordReceipt: setLifecycleReceipt,
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
) {
  if (route === 'satisfied' && installedState) {
    return { kind: 'success' as const, value: { changed: false, value: { installedState } } }
  }
  if (route === 'adopt' && adoptableMethod) {
    const tracked = await trackInstalledAgent(agent, adoptableMethod)
    return tracked
      ? { kind: 'success' as const, value: { changed: true, value: { installedState: tracked } } }
      : { kind: 'cancelled' as const, reason: 'tracking-cancelled' }
  }

  if (route === 'install' && installedState) {
    const reinstalled = await reinstallInstalledAgent(agent, installedState)
    return reinstalled.success && reinstalled.installedState
      ? {
          kind: 'success' as const,
          value: { changed: true, value: { installedState: reinstalled.installedState } },
        }
      : { kind: 'failed' as const, reason: 'install-failed', retryable: false }
  }

  const installed = await installAgent(agent)
  if (!installed.success || !installed.installedState) {
    return { kind: 'failed' as const, reason: 'install-failed', retryable: false }
  }
  return {
    kind: 'success' as const,
    value: { changed: true, value: { installedState: installed.installedState } },
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

  const cliContext = getCliContext()
  const controller = new AbortController()
  if (cliContext.cancelled) controller.abort('cli-cancelled')
  const [binaryPresent, providerOutcome] = await Promise.all([
    isBinaryInPath(agent.binaryName),
    observeLifecycleProvider(binding, {
      signal: controller.signal,
      timeoutMs: cliContext.timeoutMs,
    }),
  ])
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

function createInstallationObservation(
  agent: AgentDefinition,
  inPath: boolean,
  installedState: InstalledAgentState | undefined,
  adoptableMethod: InstallMethod | undefined,
): LifecycleObservation {
  if (!inPath) {
    return {
      drift: installedState ? { kind: 'recorded-absent' } : { kind: 'none' },
      kind: 'absent',
      targetId: agent.name,
    }
  }

  return {
    drift: installedState ? { kind: 'none' } : { kind: 'untracked' },
    kind: 'present',
    providerId: getProviderId(installedState ?? adoptableMethod),
    providerTargetId: getProviderTargetId(agent, installedState ?? adoptableMethod),
    targetId: agent.name,
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
