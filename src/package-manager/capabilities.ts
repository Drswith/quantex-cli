import type { InstallType, ManagedInstallType } from '../agents/types'
import { firstPartyProviderRegistry } from '../providers/first-party'

interface InstallerCapabilities {
  canInstall: true
  canLookupLatestVersion: boolean
  canUninstall: boolean
  canUpdate: boolean
  lifecycle: 'managed' | 'unmanaged'
}

const managedInstallTypes = Object.freeze(
  firstPartyProviderRegistry
    .list()
    .filter(adapter => {
      const capabilities = firstPartyProviderRegistry.getCapabilities(adapter.id)
      return capabilities.includes('update') && capabilities.includes('uninstall')
    })
    .map(adapter => adapter.id as ManagedInstallType),
)

export function getInstallerCapabilities(type: InstallType): InstallerCapabilities {
  const capabilities = firstPartyProviderRegistry.getCapabilities(type)
  if (!capabilities.includes('install')) {
    throw new Error(`First-party provider ${type} must implement install`)
  }

  const canUpdate = capabilities.includes('update')
  const canUninstall = capabilities.includes('uninstall')
  return {
    canInstall: true,
    canLookupLatestVersion: capabilities.includes('resolve-latest-version'),
    canUninstall,
    canUpdate,
    lifecycle: canUpdate && canUninstall ? 'managed' : 'unmanaged',
  }
}

export function getManagedInstallTypes(): readonly ManagedInstallType[] {
  return managedInstallTypes
}

export function isManagedInstallType(type: InstallType): type is ManagedInstallType {
  return managedInstallTypes.includes(type as ManagedInstallType)
}

export function getInstallLifecycle(type: InstallType): 'managed' | 'unmanaged' {
  return getInstallerCapabilities(type).lifecycle
}

export function canUpdateInstallType(type: InstallType): boolean {
  return getInstallerCapabilities(type).canUpdate
}

export function canUninstallInstallType(type: InstallType): boolean {
  return getInstallerCapabilities(type).canUninstall
}

export function canLookupLatestVersionForInstallType(type: InstallType): boolean {
  return getInstallerCapabilities(type).canLookupLatestVersion
}
