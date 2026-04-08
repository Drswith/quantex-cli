import type { AgentDefinition, InstallMethod, InstallType, ManagedInstallType, PackageTargetKind } from '../agents/types'
import type { InstalledAgentState } from '../state'

function formatPackageTarget(packageName?: string, packageTargetKind?: PackageTargetKind): string {
  if (!packageName)
    return ''

  if (packageTargetKind === 'cask')
    return ` (${packageName} cask)`

  if (packageTargetKind === 'id')
    return ` (${packageName} id)`

  return ` (${packageName})`
}

export function isManagedInstallType(type: InstallType): type is ManagedInstallType {
  return type === 'bun' || type === 'npm' || type === 'brew' || type === 'winget'
}

export function getInstallLifecycle(type: InstallType): 'managed' | 'unmanaged' {
  return isManagedInstallType(type) ? 'managed' : 'unmanaged'
}

export function getManagedPackageName(agent: Pick<AgentDefinition, 'package'>, method: Pick<InstallMethod, 'packageName'>): string | undefined {
  return method.packageName || agent.package || undefined
}

export function canUpdateInstallType(type: InstallType): boolean {
  return isManagedInstallType(type)
}

export function canUpdateInstalledState(state?: Pick<InstalledAgentState, 'installType'>): boolean {
  if (!state)
    return false

  return canUpdateInstallType(state.installType)
}

export function canLookupLatestVersionForState(state?: Pick<InstalledAgentState, 'installType'>): boolean {
  return state?.installType === 'bun' || state?.installType === 'npm'
}

export function canLookupLatestVersionForMethods(methods: Pick<InstallMethod, 'type'>[]): boolean {
  return methods.length > 0 && methods.every(method => method.type === 'bun' || method.type === 'npm')
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

export function formatUpdateManagement(state?: Pick<InstalledAgentState, 'installType'>): string {
  return canUpdateInstalledState(state) ? 'managed update' : 'manual update'
}

export function formatInstallMethodCommand(agent: Pick<AgentDefinition, 'package'>, method: InstallMethod): string {
  if (method.type === 'bun') {
    const packageName = getManagedPackageName(agent, method)
    return packageName ? `bun add -g ${packageName}` : method.command
  }

  if (method.type === 'npm') {
    const packageName = getManagedPackageName(agent, method)
    return packageName ? `npm i -g ${packageName}` : method.command
  }

  if (method.type === 'brew') {
    if (!method.packageName)
      return method.command
    return method.packageTargetKind === 'cask'
      ? `brew install --cask ${method.packageName}`
      : `brew install ${method.packageName}`
  }

  if (method.type === 'winget') {
    return method.packageName ? `winget install --id ${method.packageName} -e` : method.command
  }

  return method.command
}

export function getLatestVersionPackage(
  agent: Pick<AgentDefinition, 'package'>,
  state: Pick<InstalledAgentState, 'installType' | 'packageName'> | undefined,
  methods: Pick<InstallMethod, 'type'>[],
): string | undefined {
  if (state) {
    if (!canLookupLatestVersionForState(state))
      return undefined

    return state.packageName || agent.package || undefined
  }

  if (!agent.package || !canLookupLatestVersionForMethods(methods))
    return undefined

  return agent.package
}
