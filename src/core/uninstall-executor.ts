import type { AgentDefinition } from '../agents/types'
import type { LifecycleReceipt } from '../lifecycle/model'
import type { LifecycleProviderBinding } from '../lifecycle/provider-binding'
import type { ProviderOutcome, ProviderObservation } from '../providers/types'
import type { InstalledAgentState } from '../state'
import { getAgentByNameOrAlias } from '../agents'
import {
  observeLifecycleProvider,
  providerBindingsEqual,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../lifecycle'
import { waitForUninstallAbsence } from '../lifecycle/uninstall-postcondition'
import { uninstallInstalledAgentOutcome, withAgentLifecycleLock } from '../package-manager'
import {
  getInstalledAgentState,
  getLifecycleReceipt,
  removeInstalledAgentState,
  removeLifecycleReceipt,
  setInstalledAgentState,
  setLifecycleReceipt,
} from '../state'
import { isBinaryInPath } from '../utils/detect'
import { canUninstallInstallType } from '../utils/install'
import { isResourceLockError, type ResourceLockError } from '../utils/lock'

export type CoreUninstallFailureLifecycle =
  | 'conflicting-source'
  | 'indeterminate-source'
  | 'provider-failure'
  | 'verification-failed'

export type CoreUninstallExecutionOutcome =
  | {
      readonly agent: AgentDefinition
      readonly kind: 'agent-not-found'
      readonly name: string
    }
  | {
      readonly agent: AgentDefinition
      readonly kind: 'unmanaged'
      readonly name: string
    }
  | {
      readonly agent: AgentDefinition
      readonly kind: 'locked'
      readonly lock: ResourceLockError
    }
  | {
      readonly agent: AgentDefinition
      readonly kind: 'failed'
      readonly lifecycle: CoreUninstallFailureLifecycle
      readonly message: string
    }
  | {
      readonly agent: AgentDefinition
      readonly kind: 'dry-run'
      readonly action: string
    }
  | {
      readonly agent: AgentDefinition
      readonly kind: 'ghost-reconciled'
    }
  | {
      readonly agent: AgentDefinition
      readonly changed: true
      readonly kind: 'uninstalled'
    }

export interface CoreUninstallExecutorPorts {
  readonly dryRun: boolean
  readonly isBinaryInPath: (binaryName: string) => Promise<boolean>
  readonly isCancelled: () => boolean
  readonly observeProvider: (binding: LifecycleProviderBinding) => Promise<ProviderOutcome<ProviderObservation>>
  readonly readInstalledState: (agentName: string) => Promise<InstalledAgentState | undefined>
  readonly readReceipt: (agentName: string) => Promise<LifecycleReceipt | undefined>
  readonly removeInstalledState: (agentName: string) => Promise<void>
  readonly removeReceipt: (agentName: string) => Promise<void>
  readonly resolveAgent: (name: string) => AgentDefinition | undefined
  readonly setInstalledState: (state: InstalledAgentState) => Promise<void>
  readonly setReceipt: (receipt: LifecycleReceipt) => Promise<void>
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  readonly uninstallInstalled: typeof uninstallInstalledAgentOutcome
  readonly withMutationLock: typeof withAgentLifecycleLock
}

export interface CoreUninstallRequest {
  readonly name: string
}

/**
 * In-repo Core uninstall engine. Absent from the published SDK entry point.
 */
export async function executeCoreUninstall(
  request: CoreUninstallRequest,
  ports: CoreUninstallExecutorPorts = createProductionCoreUninstallPorts(),
): Promise<CoreUninstallExecutionOutcome> {
  const agent = ports.resolveAgent(request.name)
  if (!agent) return { agent: unknownAgent(request.name), kind: 'agent-not-found', name: request.name }

  try {
    return await ports.withMutationLock(async () => executeLockedUninstall(agent, request.name, ports))
  } catch (error) {
    if (isResourceLockError(error)) return { agent, kind: 'locked', lock: error }
    throw error
  }
}

async function executeLockedUninstall(
  agent: AgentDefinition,
  inputName: string,
  ports: CoreUninstallExecutorPorts,
): Promise<CoreUninstallExecutionOutcome> {
  const [installedState, receipt] = await Promise.all([
    ports.readInstalledState(agent.name),
    ports.readReceipt(agent.name),
  ])
  if (!installedState && !receipt) return { agent, kind: 'unmanaged', name: inputName }

  const liveBefore = await ports.isBinaryInPath(agent.binaryName)
  const stateBinding = installedState ? resolveStateProviderBinding(agent, installedState) : undefined
  const receiptBinding = receipt ? resolveReceiptProviderBinding(receipt) : undefined
  if ((installedState && !stateBinding) || (receipt && !receiptBinding)) {
    return {
      agent,
      kind: 'failed',
      lifecycle: 'indeterminate-source',
      message: `Cannot resolve provider evidence for ${agent.displayName}.`,
    }
  }
  // The agent's binary name is the default both records fall back to: state bindings omit the
  // executable name for package providers, while receipts written by update always carry it.
  if (stateBinding && receiptBinding && !providerBindingsEqual(stateBinding, receiptBinding, agent.binaryName)) {
    return {
      agent,
      kind: 'failed',
      lifecycle: 'conflicting-source',
      message: `Recorded sources disagree for ${agent.displayName}.`,
    }
  }

  const binding = stateBinding ?? receiptBinding!
  const providerBefore = await ports.observeProvider(binding)
  if (providerBefore.kind !== 'success') {
    return {
      agent,
      kind: 'failed',
      lifecycle: 'indeterminate-source',
      message: `Cannot verify provider state for ${agent.displayName}.`,
    }
  }

  if (providerBefore.value.kind === 'absent') {
    if (liveBefore) {
      return {
        agent,
        kind: 'failed',
        lifecycle: 'conflicting-source',
        message: `${agent.displayName} is on PATH but its recorded provider target is absent.`,
      }
    }
    if (ports.dryRun) return { action: 'would reconcile stale lifecycle evidence', agent, kind: 'dry-run' }
    if (installedState) await ports.removeInstalledState(agent.name)
    if (receipt) await ports.removeReceipt(agent.name)
    return { agent, kind: 'ghost-reconciled' }
  }

  if (!installedState) {
    return {
      agent,
      kind: 'failed',
      lifecycle: 'indeterminate-source',
      message: `Cannot safely reconstruct ${agent.displayName}'s uninstall source.`,
    }
  }

  if (ports.dryRun) return { action: `would uninstall ${agent.displayName}`, agent, kind: 'dry-run' }

  if (!canUninstallInstallType(installedState.installType)) {
    const uninstallOutcome = await ports.uninstallInstalled(agent, installedState)
    if (uninstallOutcome.kind !== 'success') {
      return {
        agent,
        kind: 'failed',
        lifecycle: 'provider-failure',
        message: `Failed to uninstall ${agent.displayName}.`,
      }
    }
    await ports.removeReceipt(agent.name)
    return { agent, changed: true, kind: 'uninstalled' }
  }

  if (!receipt) {
    await ports.setReceipt({
      ...(binding.target.binaryName ? { executableName: binding.target.binaryName } : {}),
      kind: 'lifecycle-receipt',
      providerId: binding.providerId,
      providerTargetId: binding.target.id,
      providerTargetKind: binding.target.kind,
      schemaVersion: 1,
      targetId: agent.name,
      verifiedAt: new Date().toISOString(),
      ...(providerBefore.value.executablePath ? { executablePath: providerBefore.value.executablePath } : {}),
      ...(providerBefore.value.version ? { version: providerBefore.value.version } : {}),
    })
  }

  const uninstallOutcome = await ports.uninstallInstalled(agent, installedState)
  if (uninstallOutcome.kind !== 'success') {
    return {
      agent,
      kind: 'failed',
      lifecycle: 'provider-failure',
      message: `Failed to uninstall ${agent.displayName}.`,
    }
  }

  const postconditionSatisfied = await waitForUninstallAbsence(
    async () => {
      const providerAfter = await ports.observeProvider(binding)
      if (providerAfter.kind !== 'success' || providerAfter.value.kind !== 'absent') return false
      return !(await ports.isBinaryInPath(agent.binaryName))
    },
    { isCancelled: ports.isCancelled },
  )
  if (!postconditionSatisfied) {
    const providerAfterFailure = await ports.observeProvider(binding)
    if (providerAfterFailure.kind === 'success' && providerAfterFailure.value.kind === 'absent') {
      await ports.removeReceipt(agent.name)
      return {
        agent,
        kind: 'failed',
        lifecycle: 'conflicting-source',
        message: `${agent.displayName}'s managed package was removed, but another copy remains on PATH.`,
      }
    }
    await ports.setInstalledState(installedState)
    return {
      agent,
      kind: 'failed',
      lifecycle: 'verification-failed',
      message: `${agent.displayName} is still present after provider removal.`,
    }
  }

  await ports.removeReceipt(agent.name)
  return { agent, changed: true, kind: 'uninstalled' }
}

export function createProductionCoreUninstallPorts(
  options: {
    readonly dryRun?: boolean
    readonly isCancelled?: () => boolean
    readonly signal?: AbortSignal
    readonly timeoutMs?: number
  } = {},
): CoreUninstallExecutorPorts {
  const signal = options.signal
  return {
    dryRun: options.dryRun ?? false,
    isBinaryInPath,
    isCancelled: options.isCancelled ?? (() => Boolean(signal?.aborted)),
    observeProvider: binding =>
      observeLifecycleProvider(binding, {
        signal: signal ?? new AbortController().signal,
        timeoutMs: options.timeoutMs,
      }),
    readInstalledState: getInstalledAgentState,
    readReceipt: getLifecycleReceipt,
    removeInstalledState: removeInstalledAgentState,
    removeReceipt: removeLifecycleReceipt,
    resolveAgent: getAgentByNameOrAlias,
    setInstalledState: setInstalledAgentState,
    setReceipt: setLifecycleReceipt,
    signal,
    timeoutMs: options.timeoutMs,
    uninstallInstalled: uninstallInstalledAgentOutcome,
    withMutationLock: withAgentLifecycleLock,
  }
}

function unknownAgent(name: string): AgentDefinition {
  return {
    binaryName: name,
    displayName: name,
    homepage: '',
    name,
    platforms: {},
  }
}
