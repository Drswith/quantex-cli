import type { AgentDefinition, InstallMethod, ManagedInstallType } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import type { LifecycleOutcome } from '../lifecycle/model'
import type { ProviderOperationContext } from '../providers'
import type { InstalledAgentState } from '../state'
import type { ManagedInstallerUpdateOptions, ManagedMutationOutcome, ManagedPackageSpec } from './installers'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getCliContext } from '../cli-context'
import { loadConfig } from '../config'
import { binaryProviderAdapter, scriptProviderAdapter } from '../providers/adapters/install-effect'
import { createCliOperationContext, resolveCliProviderOutputPolicy } from '../runtime/cli-operation-context'
import { getInstalledAgentState, removeInstalledAgentState, setInstalledAgentState } from '../state'
import { getPlatform } from '../utils/detect'
import {
  canUninstallInstallType,
  canUpdateInstallType,
  getManagedPackageName,
  isManagedInstallType,
} from '../utils/install'
import { withResourceLock } from '../utils/lock'
import { runBinaryInstall } from './binary'
import { getTypedManagedInstaller } from './installers'

export type { ManagedInstallType } from '../agents/types'
export type { ManagedPackageSpec } from './installers'

export interface AgentOperationResult {
  success: boolean
  installedState?: InstalledAgentState
}

export interface AgentMutationValue {
  readonly installedState?: InstalledAgentState
}

export type AgentMutationOutcome = LifecycleOutcome<AgentMutationValue>

const lifecycleLock = {
  resource: 'agent lifecycle',
  scope: ['agent-lifecycle'],
} as const
const lifecycleLockContext = new AsyncLocalStorage<boolean>()

export function withAgentLifecycleLock<T>(run: () => Promise<T>): Promise<T> {
  if (lifecycleLockContext.getStore()) return run()
  return withResourceLock(lifecycleLock, () => lifecycleLockContext.run(true, run))
}

async function getPreferredManagedInstallType(): Promise<ManagedInstallType | undefined> {
  const config = await loadConfig()
  return config.defaultPackageManager
}

async function getManagedUpdateOptions(): Promise<ManagedInstallerUpdateOptions> {
  const config = await loadConfig()
  return {
    npmBunUpdateStrategy: config.npmBunUpdateStrategy,
  }
}

export async function getOrderedInstallMethods(agent: AgentDefinition): Promise<InstallMethod[]> {
  const platform = getPlatform()
  const methods = agent.platforms[platform]
  if (!methods) return []

  const preferredType = await getPreferredManagedInstallType()
  if (!preferredType) return [...methods]

  return [
    ...methods.filter(method => method.type === preferredType),
    ...methods.filter(method => method.type !== preferredType),
  ]
}

async function executeManagedMethod(
  type: ManagedInstallType,
  packageName: string,
  binaryName: string | undefined,
  packageInstallArgs: string[] | undefined,
  packageTargetKind: InstalledAgentState['packageTargetKind'],
  action: 'install' | 'update' | 'uninstall',
  updateStrategy?: NpmBunUpdateStrategy,
  context?: ProviderOperationContext,
): Promise<ManagedMutationOutcome> {
  if (!context) {
    const operation = createCliOperationContext()
    try {
      return await executeManagedMethod(
        type,
        packageName,
        binaryName,
        packageInstallArgs,
        packageTargetKind,
        action,
        updateStrategy,
        operation.context,
      )
    } finally {
      operation.dispose()
    }
  }

  const installer = getTypedManagedInstaller(type)
  if (!(await installer.isAvailable(context))) {
    return { kind: 'unavailable', reason: `${type} executable is unavailable`, retryable: false }
  }

  if (action === 'install') return installer.install(packageName, packageTargetKind, packageInstallArgs, context)

  if (action === 'update')
    return installer.update(
      packageName,
      packageTargetKind,
      {
        binaryName,
        npmBunUpdateStrategy: updateStrategy,
        packageInstallArgs,
      },
      context,
    )

  return installer.uninstall(packageName, packageTargetKind, { binaryName }, context)
}

async function executeMethod(
  agent: AgentDefinition,
  method: InstallMethod,
  action: 'install' | 'update',
  updateStrategy?: NpmBunUpdateStrategy,
): Promise<ManagedMutationOutcome> {
  if (isManagedInstallType(method.type)) {
    const packageName = getManagedPackageName(agent, method)
    if (!packageName) {
      return { kind: 'failed', reason: `package target is missing for ${agent.name}`, retryable: false }
    }

    return executeManagedMethod(
      method.type,
      packageName,
      method.binaryName ?? agent.binaryName,
      method.packageInstallArgs,
      method.packageTargetKind,
      action,
      updateStrategy,
    )
  }

  if (action === 'update' && !canUpdateInstallType(method.type)) {
    return { kind: 'unsupported', operation: 'update' }
  }

  if (!method.command)
    return { kind: 'failed', reason: `install effect is missing for ${agent.name}`, retryable: false }
  const adapter = method.type === 'script' ? scriptProviderAdapter : binaryProviderAdapter
  const operation = createCliOperationContext()
  try {
    const outcome = await adapter.install?.({
      context: operation.context,
      target: {
        binaryName: method.binaryName ?? agent.binaryName,
        effect: { command: method.command, kind: 'shell-script' },
        id: agent.name,
        kind: method.type,
      },
    })
    return outcome ?? { kind: 'unsupported', operation: action }
  } finally {
    operation.dispose()
  }
}

function resolveManagedPackageName(
  state: InstalledAgentState,
  agent?: Pick<AgentDefinition, 'packages'>,
): string | undefined {
  if (state.packageName) return state.packageName
  if (!agent || !isManagedInstallType(state.installType)) return undefined

  return getManagedPackageName(agent, { type: state.installType })
}

async function executeInstalledState(
  state: InstalledAgentState,
  action: 'install' | 'update' | 'uninstall',
  options?: {
    agent?: Pick<AgentDefinition, 'packages'>
    updateStrategy?: NpmBunUpdateStrategy
  },
): Promise<ManagedMutationOutcome> {
  if (isManagedInstallType(state.installType)) {
    const packageName = resolveManagedPackageName(state, options?.agent)
    if (!packageName) {
      return { kind: 'failed', reason: `package target is missing for ${state.agentName}`, retryable: false }
    }

    return executeManagedMethod(
      state.installType,
      packageName,
      state.binaryName,
      state.packageInstallArgs,
      state.packageTargetKind,
      action,
      options?.updateStrategy,
    )
  }

  if (action !== 'install' || !state.command) return { kind: 'unsupported', operation: action }

  return (await runBinaryInstall(state.command))
    ? { kind: 'success', value: undefined }
    : { kind: 'failed', reason: `${action} command failed for ${state.agentName}`, retryable: false }
}

async function rollbackManagedInstall(agent: AgentDefinition, method: InstallMethod): Promise<void> {
  if (!isManagedInstallType(method.type)) return

  const packageName = getManagedPackageName(agent, method)
  if (!packageName) return

  await executeManagedMethod(
    method.type,
    packageName,
    method.binaryName ?? agent.binaryName,
    method.packageInstallArgs,
    method.packageTargetKind,
    'uninstall',
    undefined,
    createCompensationContext(),
  )
}

async function executeAgentUpdateCommand(agent: AgentDefinition): Promise<boolean> {
  if (!agent.selfUpdate) return false

  const commands = [agent.selfUpdate.command, ...(agent.selfUpdate.fallbackCommands ?? [])]

  for (const command of commands) {
    if (await runBinaryInstall(command.join(' '))) return true
  }

  return false
}

export function buildInstalledAgentState(agent: AgentDefinition, method: InstallMethod): InstalledAgentState {
  const installedState: InstalledAgentState = {
    agentName: agent.name,
    installType: method.type,
    packageName: getManagedPackageName(agent, method),
    packageTargetKind: method.packageTargetKind,
    command: 'command' in method ? method.command : undefined,
  }
  const binaryName = method.binaryName ?? (method.type === 'deno' ? agent.binaryName : undefined)

  if (binaryName) installedState.binaryName = binaryName
  if (method.packageInstallArgs?.length) installedState.packageInstallArgs = method.packageInstallArgs

  return installedState
}

async function persistInstalledStateIfNotCancelled(
  agent: AgentDefinition,
  method: InstallMethod,
): Promise<InstalledAgentState | null> {
  if (getCliContext().cancelled) return null

  const installedState = buildInstalledAgentState(agent, method)
  if (getCliContext().cancelled) return null

  await setInstalledAgentState(installedState)
  if (getCliContext().cancelled) {
    await removeInstalledAgentState(agent.name)
    return null
  }

  return installedState
}

export async function trackInstalledAgent(
  agent: AgentDefinition,
  method: InstallMethod,
): Promise<InstalledAgentState | null> {
  return withAgentLifecycleLock(async () => persistInstalledStateIfNotCancelled(agent, method))
}

export async function installAgentOutcome(
  agent: AgentDefinition,
  selectedMethods?: readonly InstallMethod[],
): Promise<AgentMutationOutcome> {
  return withAgentLifecycleLock(async () => {
    const methods = selectedMethods ? [...selectedMethods] : await getOrderedInstallMethods(agent)
    let lastFailure: AgentMutationOutcome | undefined

    for (const method of methods) {
      if (getCliContext().cancelled) {
        return { kind: 'cancelled', reason: 'install-cancelled' }
      }

      const execution = await executeMethod(agent, method, 'install')
      if (execution.kind === 'success') {
        if (getCliContext().cancelled) {
          await rollbackManagedInstall(agent, method)
          return { kind: 'cancelled', reason: 'install-cancelled' }
        }

        return { kind: 'success', value: { installedState: buildInstalledAgentState(agent, method) } }
      }

      const typedFailure = projectManagedMutationOutcome(execution)
      if (typedFailure.kind === 'cancelled' || typedFailure.kind === 'timed-out') return typedFailure
      lastFailure = typedFailure

      if (getCliContext().cancelled) {
        await rollbackManagedInstall(agent, method)
        return { kind: 'cancelled', reason: 'install-cancelled' }
      }
    }

    return lastFailure ?? { kind: 'failed', reason: 'install-failed', retryable: false }
  })
}

export async function installAgent(agent: AgentDefinition): Promise<AgentOperationResult> {
  return withAgentLifecycleLock(async () => {
    const outcome = await installAgentOutcome(agent)
    if (outcome.kind !== 'success' || !outcome.value.installedState) return projectAgentMutationOutcome(outcome)

    try {
      if (getCliContext().cancelled) {
        await rollbackInstalledAgentInstallation(agent, outcome.value.installedState)
        return { success: false }
      }
      await setInstalledAgentState(outcome.value.installedState)
      if (getCliContext().cancelled) {
        await removeInstalledAgentState(agent.name)
        await rollbackInstalledAgentInstallation(agent, outcome.value.installedState)
        return { success: false }
      }
      return projectAgentMutationOutcome(outcome)
    } catch (error) {
      await rollbackInstalledAgentInstallation(agent, outcome.value.installedState)
      throw error
    }
  })
}

export async function updateAgentOutcome(
  agent: AgentDefinition,
  preferredState?: InstalledAgentState,
): Promise<AgentMutationOutcome> {
  return withAgentLifecycleLock(async () => {
    const { npmBunUpdateStrategy } = await getManagedUpdateOptions()
    const methods = await getOrderedInstallMethods(agent)

    const recordedManagedPackageName =
      preferredState && isManagedInstallType(preferredState.installType)
        ? resolveManagedPackageName(preferredState, agent)
        : undefined

    const preferredExecution = preferredState
      ? await executeInstalledState(preferredState, 'update', {
          agent,
          updateStrategy: npmBunUpdateStrategy,
        })
      : undefined
    if (preferredState && preferredExecution?.kind === 'success') {
      if (getCliContext().cancelled) return { kind: 'cancelled', reason: 'update-cancelled' }

      await setInstalledAgentState(preferredState)
      if (getCliContext().cancelled) return { kind: 'cancelled', reason: 'update-cancelled' }

      return { kind: 'success', value: { installedState: preferredState } }
    }
    if (preferredExecution?.kind === 'cancelled' || preferredExecution?.kind === 'timed-out') {
      return projectManagedMutationOutcome(preferredExecution)
    }

    if (!preferredState) {
      for (const method of methods) {
        const execution = await executeMethod(agent, method, 'update', npmBunUpdateStrategy)
        if (execution.kind === 'success') {
          const installedState = await persistInstalledStateIfNotCancelled(agent, method)
          if (!installedState) return { kind: 'cancelled', reason: 'update-cancelled' }

          return { kind: 'success', value: { installedState } }
        }
        if (execution.kind === 'cancelled' || execution.kind === 'timed-out') {
          return projectManagedMutationOutcome(execution)
        }
      }
    }

    if (
      (!preferredState || !isManagedInstallType(preferredState.installType) || recordedManagedPackageName) &&
      (await executeAgentUpdateCommand(agent))
    ) {
      return { kind: 'success', value: {} }
    }

    return { kind: 'failed', reason: 'update-failed', retryable: false }
  })
}

export async function updateAgent(
  agent: AgentDefinition,
  preferredState?: InstalledAgentState,
): Promise<AgentOperationResult> {
  return projectAgentMutationOutcome(await updateAgentOutcome(agent, preferredState))
}

export async function updateAgentsByType(type: ManagedInstallType, packages: ManagedPackageSpec[]): Promise<boolean> {
  return withAgentLifecycleLock(async () => {
    const uniquePackages = [
      ...new Map(
        packages
          .filter(pkg => pkg.packageName)
          .map(pkg => [
            `${pkg.packageTargetKind ?? 'package'}:${pkg.packageName}:${pkg.packageInstallArgs?.join(' ') ?? ''}`,
            pkg,
          ]),
      ).values(),
    ]
    if (uniquePackages.length === 0) {
      return false
    }

    const installer = getTypedManagedInstaller(type)
    if (!(await installer.isAvailable())) return false
    return (await installer.updateMany(uniquePackages, await getManagedUpdateOptions())).kind === 'success'
  })
}

export async function getManagedInstalledPackageVersion(
  type: ManagedInstallType,
  packageName: string,
  packageTargetKind?: InstalledAgentState['packageTargetKind'],
): Promise<string | undefined> {
  const installer = getTypedManagedInstaller(type)
  if (!installer.getInstalledVersion) return undefined
  if (!(await installer.isAvailable())) return undefined

  return installer.getInstalledVersion(packageName, packageTargetKind)
}

async function isManagedPackageAbsent(
  state: InstalledAgentState,
  agent?: Pick<AgentDefinition, 'packages'>,
): Promise<boolean> {
  if (!isManagedInstallType(state.installType)) return false

  const installer = getTypedManagedInstaller(state.installType)
  if (!installer.getInstalledVersion) return false
  if (!(await installer.isAvailable())) return false

  const packageName = resolveManagedPackageName(state, agent)
  if (!packageName) return false

  if (installer.probePackagePresence) {
    const presence = await installer.probePackagePresence(packageName, state.packageTargetKind)
    return presence === 'absent'
  }

  const installedVersion = await installer.getInstalledVersion(packageName, state.packageTargetKind)
  return installedVersion === undefined
}

export async function uninstallAgent(agent: AgentDefinition): Promise<boolean> {
  const outcome = await withAgentLifecycleLock(async (): Promise<AgentMutationOutcome> => {
    const installedState = await getInstalledAgentState(agent.name)
    if (!installedState) return { kind: 'failed', reason: 'installed-state-missing', retryable: false }

    return uninstallInstalledAgentOutcome(agent, installedState)
  })
  return outcome.kind === 'success'
}

export async function uninstallInstalledAgentOutcome(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<AgentMutationOutcome> {
  if (!canUninstallInstallType(installedState.installType)) {
    await removeInstalledAgentState(agent.name)
    return { kind: 'success', value: { installedState } }
  }

  const execution = await executeInstalledState(installedState, 'uninstall', { agent })
  if (execution.kind === 'success') {
    await removeInstalledAgentState(agent.name)
    return { kind: 'success', value: { installedState } }
  }

  if (await isManagedPackageAbsent(installedState, agent)) {
    await removeInstalledAgentState(agent.name)
    return { kind: 'success', value: { installedState } }
  }

  return projectManagedMutationOutcome(execution)
}

export async function uninstallInstalledAgent(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<boolean> {
  return (await uninstallInstalledAgentOutcome(agent, installedState)).kind === 'success'
}

export async function reinstallInstalledAgentOutcome(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<AgentMutationOutcome> {
  const execution = await executeInstalledState(installedState, 'install', { agent })
  if (execution.kind !== 'success') return projectManagedMutationOutcome(execution)
  return { kind: 'success', value: { installedState } }
}

export async function reinstallInstalledAgent(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<AgentOperationResult> {
  const outcome = await reinstallInstalledAgentOutcome(agent, installedState)
  if (outcome.kind === 'success') await setInstalledAgentState(installedState)
  return projectAgentMutationOutcome(outcome)
}

export async function rollbackInstalledAgentInstallation(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<void> {
  if (!canUninstallInstallType(installedState.installType)) return
  if (!isManagedInstallType(installedState.installType)) return
  const packageName = resolveManagedPackageName(installedState, agent)
  if (!packageName) return
  await executeManagedMethod(
    installedState.installType,
    packageName,
    installedState.binaryName,
    installedState.packageInstallArgs,
    installedState.packageTargetKind,
    'uninstall',
    undefined,
    createCompensationContext(),
  )
}

function createCompensationContext(): ProviderOperationContext {
  const cliContext = getCliContext()
  const timeoutMs = cliContext.timeoutMs
  return {
    outputPolicy: resolveCliProviderOutputPolicy(cliContext.outputMode),
    signal: new AbortController().signal,
    timeoutMs: timeoutMs === undefined ? 5_000 : Math.max(10, Math.min(timeoutMs, 5_000)),
  }
}

function projectAgentMutationOutcome(outcome: AgentMutationOutcome): AgentOperationResult {
  if (outcome.kind !== 'success') return { success: false }
  return outcome.value.installedState
    ? { installedState: outcome.value.installedState, success: true }
    : { success: true }
}

function projectManagedMutationOutcome(outcome: ManagedMutationOutcome): AgentMutationOutcome {
  switch (outcome.kind) {
    case 'success':
      return { kind: 'success', value: {} }
    case 'cancelled':
      return outcome
    case 'timed-out':
      return outcome
    case 'failed':
      return {
        kind: 'failed',
        reason: outcome.reason,
        retryable: outcome.retryable,
      }
    case 'unsupported':
      return { capability: `provider-${outcome.operation}`, kind: 'unsupported', reason: outcome.reason }
    case 'unavailable':
    case 'indeterminate':
      return { kind: 'indeterminate', reason: outcome.reason }
  }
}
