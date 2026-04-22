import type { AgentDefinition, InstallMethod, ManagedInstallType } from '../agents/types'
import type { NpmBunUpdateStrategy } from '../config'
import type { InstalledAgentState } from '../state'
import type { ManagedInstallerUpdateOptions, ManagedPackageSpec } from './installers'
import { loadConfig } from '../config'
import { getInstalledAgentState, removeInstalledAgentState, setInstalledAgentState } from '../state'
import { getPlatform } from '../utils/detect'
import { canUpdateInstallType, getManagedPackageName, isManagedInstallType } from '../utils/install'
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
  if (!methods)
    return []

  const preferredType = await getPreferredManagedInstallType()
  if (!preferredType)
    return [...methods]

  return [
    ...methods.filter(method => method.type === preferredType),
    ...methods.filter(method => method.type !== preferredType),
  ]
}

async function executeManagedMethod(
  type: ManagedInstallType,
  packageName: string,
  packageTargetKind: InstalledAgentState['packageTargetKind'],
  action: 'install' | 'update' | 'uninstall',
  updateStrategy?: NpmBunUpdateStrategy,
): Promise<boolean> {
  const installer = getManagedInstaller(type)
  if (!await installer.isAvailable())
    return false

  if (action === 'install')
    return installer.install(packageName, packageTargetKind)

  if (action === 'update')
    return installer.update(packageName, packageTargetKind, { npmBunUpdateStrategy: updateStrategy })

  return installer.uninstall(packageName, packageTargetKind)
}

async function executeMethod(
  agent: AgentDefinition,
  method: InstallMethod,
  action: 'install' | 'update',
  updateStrategy?: NpmBunUpdateStrategy,
): Promise<boolean> {
  if (isManagedInstallType(method.type)) {
    const packageName = getManagedPackageName(agent, method)
    if (!packageName)
      return false

    return executeManagedMethod(method.type, packageName, method.packageTargetKind, action, updateStrategy)
  }

  if (action === 'update' && !canUpdateInstallType(method.type))
    return false

  if (!method.command)
    return false

  return runBinaryInstall(method.command)
}

async function executeInstalledState(
  state: InstalledAgentState,
  action: 'install' | 'update' | 'uninstall',
  updateStrategy?: NpmBunUpdateStrategy,
): Promise<boolean> {
  if (isManagedInstallType(state.installType)) {
    if (!state.packageName)
      return false

    return executeManagedMethod(state.installType, state.packageName, state.packageTargetKind, action, updateStrategy)
  }

  if (action !== 'install' || !state.command)
    return false

  return runBinaryInstall(state.command)
}

async function executeAgentUpdateCommand(agent: AgentDefinition): Promise<boolean> {
  if (!agent.selfUpdate)
    return false

  const commands = [
    agent.selfUpdate.command,
    ...(agent.selfUpdate.fallbackCommands ?? []),
  ]

  for (const command of commands) {
    if (await runBinaryInstall(command.join(' ')))
      return true
  }

  return false
}

async function persistInstalledState(agent: AgentDefinition, method: InstallMethod): Promise<InstalledAgentState> {
  const installedState: InstalledAgentState = {
    agentName: agent.name,
    installType: method.type,
    packageName: getManagedPackageName(agent, method),
    packageTargetKind: method.packageTargetKind,
    command: 'command' in method ? method.command : undefined,
  }

  await setInstalledAgentState(installedState)
  return installedState
}

export async function installAgent(agent: AgentDefinition): Promise<AgentOperationResult> {
  return withResourceLock(lifecycleLock, async () => {
    const methods = await getOrderedInstallMethods(agent)

    for (const method of methods) {
      if (await executeMethod(agent, method, 'install')) {
        return {
          success: true,
          installedState: await persistInstalledState(agent, method),
        }
      }
    }

    return { success: false }
  })
}

export async function updateAgent(agent: AgentDefinition, preferredState?: InstalledAgentState): Promise<AgentOperationResult> {
  return withResourceLock(lifecycleLock, async () => {
    const { npmBunUpdateStrategy } = await getManagedUpdateOptions()
    const methods = await getOrderedInstallMethods(agent)

    if (preferredState && await executeInstalledState(preferredState, 'update', npmBunUpdateStrategy)) {
      await setInstalledAgentState(preferredState)
      return {
        success: true,
        installedState: preferredState,
      }
    }

    if (!preferredState) {
      for (const method of methods) {
        if (await executeMethod(agent, method, 'update', npmBunUpdateStrategy)) {
          return {
            success: true,
            installedState: await persistInstalledState(agent, method),
          }
        }
      }
    }

    if (await executeAgentUpdateCommand(agent))
      return { success: true }

    if (preferredState) {
      for (const method of methods) {
        if (await executeMethod(agent, method, 'update', npmBunUpdateStrategy)) {
          return {
            success: true,
            installedState: await persistInstalledState(agent, method),
          }
        }
      }
    }

    return { success: false }
  })
}

export async function updateAgentsByType(type: ManagedInstallType, packages: ManagedPackageSpec[]): Promise<boolean> {
  return withResourceLock(lifecycleLock, async () => {
    const uniquePackages = [...new Map(packages
      .filter(pkg => pkg.packageName)
      .map(pkg => [`${pkg.packageTargetKind ?? 'package'}:${pkg.packageName}`, pkg])).values()]
    const installer = getManagedInstaller(type)
    if (!await installer.isAvailable())
      return false
    return installer.updateMany(uniquePackages, await getManagedUpdateOptions())
  })
}

export async function uninstallAgent(agent: AgentDefinition): Promise<boolean> {
  return withResourceLock(lifecycleLock, async () => {
    const installedState = await getInstalledAgentState(agent.name)
    if (!installedState)
      return false

    const success = await executeInstalledState(installedState, 'uninstall')
    if (success)
      await removeInstalledAgentState(agent.name)
    return success
  })
}
