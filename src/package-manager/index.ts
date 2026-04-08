import type { AgentDefinition, InstallMethod, ManagedInstallType } from '../agents/types'
import type { InstalledAgentState } from '../state'
import { loadConfig } from '../config'
import { getInstalledAgentState, removeInstalledAgentState, setInstalledAgentState } from '../state'
import { getPlatform, isBrewAvailable, isBunAvailable, isNpmAvailable, isWingetAvailable } from '../utils/detect'
import { canUpdateInstallType, getManagedPackageName, isManagedInstallType } from '../utils/install'
import { runBinaryInstall } from './binary'
import * as brewPm from './brew'
import * as bunPm from './bun'
import * as npmPm from './npm'
import * as wingetPm from './winget'

export type { ManagedInstallType } from '../agents/types'

export interface AgentOperationResult {
  success: boolean
  installedState?: InstalledAgentState
}

export interface ManagedPackageSpec {
  packageName: string
  packageTargetKind?: InstalledAgentState['packageTargetKind']
}

async function getPreferredManagedInstallType(): Promise<ManagedInstallType | undefined> {
  const config = await loadConfig()
  return config.defaultPackageManager
}

function compareInstallMethods(
  preferredType: ManagedInstallType | undefined,
  left: InstallMethod,
  right: InstallMethod,
): number {
  const leftPreferred = left.type === preferredType
  const rightPreferred = right.type === preferredType
  if (leftPreferred !== rightPreferred)
    return leftPreferred ? -1 : 1

  return left.priority - right.priority
}

export async function getOrderedInstallMethods(agent: AgentDefinition): Promise<InstallMethod[]> {
  const platform = getPlatform()
  const methods = agent.platforms[platform]
  if (!methods)
    return []

  const preferredType = await getPreferredManagedInstallType()
  return [...methods].sort((left, right) => compareInstallMethods(preferredType, left, right))
}

async function executeManagedMethod(
  type: ManagedInstallType,
  packageName: string,
  packageTargetKind: InstalledAgentState['packageTargetKind'],
  action: 'install' | 'update' | 'uninstall',
): Promise<boolean> {
  if (type === 'bun') {
    if (!await isBunAvailable())
      return false
    return action === 'install'
      ? bunPm.install(packageName)
      : action === 'update'
        ? bunPm.update(packageName)
        : bunPm.uninstall(packageName)
  }

  if (type === 'npm') {
    if (!await isNpmAvailable())
      return false
    return action === 'install'
      ? npmPm.install(packageName)
      : action === 'update'
        ? npmPm.update(packageName)
        : npmPm.uninstall(packageName)
  }

  if (type === 'brew') {
    if (!await isBrewAvailable())
      return false
    return action === 'install'
      ? brewPm.install(packageName, packageTargetKind)
      : action === 'update'
        ? brewPm.update(packageName, packageTargetKind)
        : brewPm.uninstall(packageName, packageTargetKind)
  }

  if (!await isWingetAvailable())
    return false

  return action === 'install'
    ? wingetPm.install(packageName)
    : action === 'update'
      ? wingetPm.update(packageName)
      : wingetPm.uninstall(packageName)
}

async function executeMethod(agent: AgentDefinition, method: InstallMethod, action: 'install' | 'update'): Promise<boolean> {
  if (isManagedInstallType(method.type)) {
    const packageName = getManagedPackageName(agent, method)
    if (!packageName)
      return false

    return executeManagedMethod(method.type, packageName, method.packageTargetKind, action)
  }

  if (action === 'update' && !canUpdateInstallType(method.type))
    return false

  return runBinaryInstall(method.command)
}

async function executeInstalledState(state: InstalledAgentState, action: 'install' | 'update' | 'uninstall'): Promise<boolean> {
  if (isManagedInstallType(state.installType)) {
    if (!state.packageName)
      return false

    return executeManagedMethod(state.installType, state.packageName, state.packageTargetKind, action)
  }

  if (action !== 'install' || !state.command)
    return false

  return runBinaryInstall(state.command)
}

async function persistInstalledState(agent: AgentDefinition, method: InstallMethod): Promise<InstalledAgentState> {
  const installedState: InstalledAgentState = {
    agentName: agent.name,
    installType: method.type,
    packageName: getManagedPackageName(agent, method),
    packageTargetKind: method.packageTargetKind,
    command: method.command,
  }

  await setInstalledAgentState(installedState)
  return installedState
}

export async function installAgent(agent: AgentDefinition): Promise<AgentOperationResult> {
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
}

export async function updateAgent(agent: AgentDefinition, preferredState?: InstalledAgentState): Promise<AgentOperationResult> {
  if (preferredState && await executeInstalledState(preferredState, 'update')) {
    await setInstalledAgentState(preferredState)
    return {
      success: true,
      installedState: preferredState,
    }
  }

  const methods = await getOrderedInstallMethods(agent)

  for (const method of methods) {
    if (await executeMethod(agent, method, 'update')) {
      return {
        success: true,
        installedState: await persistInstalledState(agent, method),
      }
    }
  }

  return { success: false }
}

export async function updateAgentsByType(type: ManagedInstallType, packages: ManagedPackageSpec[]): Promise<boolean> {
  const uniquePackages = [...new Map(packages
    .filter(pkg => pkg.packageName)
    .map(pkg => [`${pkg.packageTargetKind ?? 'package'}:${pkg.packageName}`, pkg])).values()]

  if (type === 'bun') {
    if (!await isBunAvailable())
      return false
    return bunPm.updateMany(uniquePackages.map(pkg => pkg.packageName))
  }

  if (type === 'npm') {
    if (!await isNpmAvailable())
      return false
    return npmPm.updateMany(uniquePackages.map(pkg => pkg.packageName))
  }

  if (type === 'brew') {
    if (!await isBrewAvailable())
      return false
    return brewPm.updateMany(uniquePackages)
  }

  if (!await isWingetAvailable())
    return false

  return wingetPm.updateMany(uniquePackages.map(pkg => ({ packageName: pkg.packageName })))
}

export async function uninstallAgent(agent: AgentDefinition): Promise<boolean> {
  const installedState = await getInstalledAgentState(agent.name)
  if (!installedState)
    return false

  const success = await executeInstalledState(installedState, 'uninstall')
  if (success)
    await removeInstalledAgentState(agent.name)
  return success
}
