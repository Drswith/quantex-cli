import type { InstallMethod, InstallType, ManagedInstallType, PackageTargetKind } from '../agents/types'
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
