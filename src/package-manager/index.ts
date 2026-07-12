import type { AgentDefinition, InstallMethod, ManagedInstallType } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import type { InstalledAgentState } from '../state'
import type { ManagedInstallerUpdateOptions, ManagedPackageSpec } from './installers'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getCliContext } from '../cli-context'
import { loadConfig } from '../config'
import { binaryProviderAdapter, scriptProviderAdapter } from '../providers/adapters/install-effect'
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
import { getManagedInstaller } from './installers'

export type { ManagedInstallType } from '../agents/types'
export type { ManagedPackageSpec } from './installers'

export interface AgentOperationResult {
  success: boolean
  installedState?: InstalledAgentState
}

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
): Promise<boolean> {
  const installer = getManagedInstaller(type)
  if (!(await installer.isAvailable())) return false

  if (action === 'install') return installer.install(packageName, packageTargetKind, packageInstallArgs)

  if (action === 'update')
    return installer.update(packageName, packageTargetKind, {
      binaryName,
      npmBunUpdateStrategy: updateStrategy,
      packageInstallArgs,
    })

  return installer.uninstall(packageName, packageTargetKind, { binaryName })
}

async function executeMethod(
  agent: AgentDefinition,
  method: InstallMethod,
  action: 'install' | 'update',
  updateStrategy?: NpmBunUpdateStrategy,
): Promise<boolean> {
  if (isManagedInstallType(method.type)) {
    const packageName = getManagedPackageName(agent, method)
    if (!packageName) return false

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

  if (action === 'update' && !canUpdateInstallType(method.type)) return false

  if (!method.command) return false
  const adapter = method.type === 'script' ? scriptProviderAdapter : binaryProviderAdapter
  const outcome = await adapter.install?.({
    context: { signal: new AbortController().signal },
    target: {
      binaryName: method.binaryName ?? agent.binaryName,
      effect: { command: method.command, kind: 'shell-script' },
      id: agent.name,
      kind: method.type,
    },
  })
  return outcome?.kind === 'success'
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
): Promise<boolean> {
  if (isManagedInstallType(state.installType)) {
    const packageName = resolveManagedPackageName(state, options?.agent)
    if (!packageName) return false

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

  if (action !== 'install' || !state.command) return false

  return runBinaryInstall(state.command)
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

function buildInstalledState(agent: AgentDefinition, method: InstallMethod): InstalledAgentState {
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

  const installedState = buildInstalledState(agent, method)
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

export async function installAgent(agent: AgentDefinition): Promise<AgentOperationResult> {
  return withAgentLifecycleLock(async () => {
    const methods = await getOrderedInstallMethods(agent)

    for (const method of methods) {
      if (getCliContext().cancelled) {
        return { success: false }
      }

      if (await executeMethod(agent, method, 'install')) {
        if (getCliContext().cancelled) {
          await rollbackManagedInstall(agent, method)
          return { success: false }
        }

        try {
          const installedState = await persistInstalledStateIfNotCancelled(agent, method)
          if (!installedState) {
            await rollbackManagedInstall(agent, method)
            return { success: false }
          }

          return {
            success: true,
            installedState,
          }
        } catch (error) {
          await rollbackManagedInstall(agent, method)
          throw error
        }
      }

      if (getCliContext().cancelled) {
        await rollbackManagedInstall(agent, method)
        return { success: false }
      }
    }

    return { success: false }
  })
}

export async function updateAgent(
  agent: AgentDefinition,
  preferredState?: InstalledAgentState,
): Promise<AgentOperationResult> {
  return withAgentLifecycleLock(async () => {
    const { npmBunUpdateStrategy } = await getManagedUpdateOptions()
    const methods = await getOrderedInstallMethods(agent)

    const recordedManagedPackageName =
      preferredState && isManagedInstallType(preferredState.installType)
        ? resolveManagedPackageName(preferredState, agent)
        : undefined

    if (
      preferredState &&
      (await executeInstalledState(preferredState, 'update', {
        agent,
        updateStrategy: npmBunUpdateStrategy,
      }))
    ) {
      if (getCliContext().cancelled) return { success: false }

      await setInstalledAgentState(preferredState)
      if (getCliContext().cancelled) return { success: false }

      return {
        success: true,
        installedState: preferredState,
      }
    }

    if (!preferredState) {
      for (const method of methods) {
        if (await executeMethod(agent, method, 'update', npmBunUpdateStrategy)) {
          const installedState = await persistInstalledStateIfNotCancelled(agent, method)
          if (!installedState) return { success: false }

          return {
            success: true,
            installedState,
          }
        }
      }
    }

    if (
      (!preferredState || !isManagedInstallType(preferredState.installType) || recordedManagedPackageName) &&
      (await executeAgentUpdateCommand(agent))
    ) {
      return { success: true }
    }

    return { success: false }
  })
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

    const installer = getManagedInstaller(type)
    if (!(await installer.isAvailable())) return false
    return installer.updateMany(uniquePackages, await getManagedUpdateOptions())
  })
}

export async function getManagedInstalledPackageVersion(
  type: ManagedInstallType,
  packageName: string,
  packageTargetKind?: InstalledAgentState['packageTargetKind'],
): Promise<string | undefined> {
  const installer = getManagedInstaller(type)
  if (!installer.getInstalledVersion) return undefined
  if (!(await installer.isAvailable())) return undefined

  return installer.getInstalledVersion(packageName, packageTargetKind)
}

async function isManagedPackageAbsent(
  state: InstalledAgentState,
  agent?: Pick<AgentDefinition, 'packages'>,
): Promise<boolean> {
  if (!isManagedInstallType(state.installType)) return false

  const installer = getManagedInstaller(state.installType)
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
  return withAgentLifecycleLock(async () => {
    const installedState = await getInstalledAgentState(agent.name)
    if (!installedState) return false

    return uninstallInstalledAgent(agent, installedState)
  })
}

export async function uninstallInstalledAgent(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<boolean> {
  if (!canUninstallInstallType(installedState.installType)) {
    await removeInstalledAgentState(agent.name)
    return true
  }

  const success = await executeInstalledState(installedState, 'uninstall', { agent })
  if (success) {
    await removeInstalledAgentState(agent.name)
    return true
  }

  if (await isManagedPackageAbsent(installedState, agent)) {
    await removeInstalledAgentState(agent.name)
    return true
  }

  return false
}

export async function reinstallInstalledAgent(
  agent: AgentDefinition,
  installedState: InstalledAgentState,
): Promise<AgentOperationResult> {
  const success = await executeInstalledState(installedState, 'install', { agent })
  if (!success) return { success: false }
  await setInstalledAgentState(installedState)
  return { installedState, success: true }
}
