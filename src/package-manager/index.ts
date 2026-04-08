import type { AgentDefinition, InstallMethod, InstallType } from '../agents/types'
import type { InstalledAgentState } from '../state'
import { removeInstalledAgentState, setInstalledAgentState } from '../state'
import { getPlatform, isBunAvailable, isNpmAvailable } from '../utils/detect'
import { runBinaryInstall } from './binary'
import * as bunPm from './bun'
import * as npmPm from './npm'

export type ManagedInstallType = Extract<InstallType, 'bun' | 'npm'>

export interface AgentOperationResult {
  success: boolean
  installedState?: InstalledAgentState
}

function getPlatformMethods(agent: AgentDefinition): InstallMethod[] {
  const platform = getPlatform()
  const methods = agent.platforms[platform]
  if (!methods)
    return []
  return [...methods].sort((a, b) => a.priority - b.priority)
}

async function executeMethod(agent: AgentDefinition, method: InstallMethod, action: 'install' | 'update'): Promise<boolean> {
  if (method.type === 'bun') {
    if (!agent.package || !await isBunAvailable())
      return false
    return action === 'install'
      ? bunPm.install(agent.package)
      : bunPm.update(agent.package)
  }

  if (method.type === 'npm') {
    if (!agent.package || !await isNpmAvailable())
      return false
    return action === 'install'
      ? npmPm.install(agent.package)
      : npmPm.update(agent.package)
  }

  return runBinaryInstall(method.command)
}

async function executeInstalledState(agent: AgentDefinition, state: InstalledAgentState, action: 'install' | 'update'): Promise<boolean> {
  if (state.installType === 'bun') {
    if (!state.packageName || !await isBunAvailable())
      return false
    return action === 'install'
      ? bunPm.install(state.packageName)
      : bunPm.update(state.packageName)
  }

  if (state.installType === 'npm') {
    if (!state.packageName || !await isNpmAvailable())
      return false
    return action === 'install'
      ? npmPm.install(state.packageName)
      : npmPm.update(state.packageName)
  }

  if (!state.command)
    return false

  return runBinaryInstall(state.command)
}

async function persistInstalledState(agent: AgentDefinition, method: InstallMethod): Promise<InstalledAgentState> {
  const installedState: InstalledAgentState = {
    agentName: agent.name,
    installType: method.type,
    packageName: agent.package || undefined,
    command: method.command,
  }

  await setInstalledAgentState(installedState)
  return installedState
}

export async function installAgent(agent: AgentDefinition): Promise<AgentOperationResult> {
  const methods = getPlatformMethods(agent)

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
  if (preferredState && await executeInstalledState(agent, preferredState, 'update')) {
    await setInstalledAgentState(preferredState)
    return {
      success: true,
      installedState: preferredState,
    }
  }

  const methods = getPlatformMethods(agent)

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

export async function updateAgentsByType(type: ManagedInstallType, packageNames: string[]): Promise<boolean> {
  const uniquePackages = [...new Set(packageNames.filter(Boolean))]

  if (type === 'bun') {
    if (!await isBunAvailable())
      return false
    return bunPm.updateMany(uniquePackages)
  }

  if (!await isNpmAvailable())
    return false

  return npmPm.updateMany(uniquePackages)
}

export async function uninstallAgent(agent: AgentDefinition): Promise<boolean> {
  let anySuccess = false

  if (await isBunAvailable()) {
    const result = await bunPm.uninstall(agent.package)
    anySuccess = anySuccess || result
  }

  if (await isNpmAvailable()) {
    const result = await npmPm.uninstall(agent.package)
    anySuccess = anySuccess || result
  }

  if (anySuccess)
    await removeInstalledAgentState(agent.name)

  return anySuccess
}
