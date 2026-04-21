import type { AgentDefinition, InstallMethod, PackageTargetKind } from '../agents/types'
import type { InstalledAgentState } from '../state'
import { canLookupLatestVersionForInstallType, canUpdateInstallType, getInstallLifecycle, isManagedInstallType } from '../package-manager/capabilities'

function formatPackageTarget(packageName?: string, packageTargetKind?: PackageTargetKind): string {
  if (!packageName)
    return ''

  if (packageTargetKind === 'cask')
    return ` (${packageName} cask)`

  if (packageTargetKind === 'id')
    return ` (${packageName} id)`

  return ` (${packageName})`
}

export { canUpdateInstallType, getInstallLifecycle, isManagedInstallType } from '../package-manager/capabilities'

export function getManagedPackageName(agent: Pick<AgentDefinition, 'packages'>, method: Pick<InstallMethod, 'packageName'>): string | undefined {
  return method.packageName || agent.packages?.npm || undefined
}

export function canUpdateInstalledState(state?: Pick<InstalledAgentState, 'installType'>): boolean {
  if (!state)
    return false

  return canUpdateInstallType(state.installType)
}

export function canAutoUpdateAgent(
  agent: Pick<AgentDefinition, 'update'>,
  state?: Pick<InstalledAgentState, 'installType'>,
): boolean {
  return canUpdateInstalledState(state) || !!agent.update?.commands.length
}

export function canLookupLatestVersionForState(state?: Pick<InstalledAgentState, 'installType'>): boolean {
  return !!state && canLookupLatestVersionForInstallType(state.installType)
}

export function canLookupLatestVersionForMethods(methods: Pick<InstallMethod, 'type'>[]): boolean {
  return methods.length > 0 && methods.every(method => canLookupLatestVersionForInstallType(method.type))
}

export function formatInstallMethodLabel(method: Pick<InstallMethod, 'type' | 'packageName' | 'packageTargetKind'>): string {
  if (isManagedInstallType(method.type))
    return `${getInstallLifecycle(method.type)}/${method.type}${formatPackageTarget(method.packageName, method.packageTargetKind)}`

  if (method.type === 'script')
    return 'unmanaged/script'

  return 'unmanaged/binary'
}

export function formatInstalledSource(state?: Pick<InstalledAgentState, 'installType' | 'packageName' | 'packageTargetKind'>): string {
  if (!state)
    return 'detected in PATH'

  if (isManagedInstallType(state.installType))
    return `managed via ${state.installType}${formatPackageTarget(state.packageName, state.packageTargetKind)}`

  if (state.installType === 'script')
    return 'script installer'

  return 'binary installer'
}

export function formatUpdateManagement(
  agent: Pick<AgentDefinition, 'update'>,
  state?: Pick<InstalledAgentState, 'installType'>,
): string {
  if (canUpdateInstalledState(state))
    return 'managed update'

  if (agent.update?.commands.length)
    return 'command update'

  return 'manual update'
}

export function formatInstallMethodCommand(agent: Pick<AgentDefinition, 'packages'>, method: InstallMethod): string {
  if (method.type === 'bun') {
    const packageName = getManagedPackageName(agent, method)
    return packageName ? `bun add -g ${packageName}` : ''
  }

  if (method.type === 'npm') {
    const packageName = getManagedPackageName(agent, method)
    return packageName ? `npm i -g ${packageName}` : ''
  }

  if (method.type === 'brew') {
    if (!method.packageName)
      return ''
    return method.packageTargetKind === 'cask'
      ? `brew install --cask ${method.packageName}`
      : `brew install ${method.packageName}`
  }

  if (method.type === 'winget') {
    return method.packageName ? `winget install --id ${method.packageName} -e` : ''
  }

  return method.command ?? ''
}

export function getLatestVersionPackage(
  agent: Pick<AgentDefinition, 'packages'>,
  state: Pick<InstalledAgentState, 'installType' | 'packageName'> | undefined,
  methods: Pick<InstallMethod, 'type'>[],
): string | undefined {
  if (state) {
    if (!canLookupLatestVersionForState(state))
      return undefined

    return state.packageName || agent.packages?.npm || undefined
  }

  if (!agent.packages?.npm || !canLookupLatestVersionForMethods(methods))
    return undefined

  return agent.packages.npm
}
