import type { InstallType, ManagedInstallType } from '../agents/types'

interface InstallerCapabilities {
  canInstall: true
  canLookupLatestVersion: boolean
  canUninstall: boolean
  canUpdate: boolean
  lifecycle: 'managed' | 'unmanaged'
}

const INSTALLER_CAPABILITIES: Record<InstallType, InstallerCapabilities> = {
  binary: {
    canInstall: true,
    canLookupLatestVersion: false,
    canUninstall: false,
    canUpdate: false,
    lifecycle: 'unmanaged',
  },
  brew: {
    canInstall: true,
    canLookupLatestVersion: false,
    canUninstall: true,
    canUpdate: true,
    lifecycle: 'managed',
  },
  bun: {
    canInstall: true,
    canLookupLatestVersion: true,
    canUninstall: true,
    canUpdate: true,
    lifecycle: 'managed',
  },
  npm: {
    canInstall: true,
    canLookupLatestVersion: true,
    canUninstall: true,
    canUpdate: true,
    lifecycle: 'managed',
  },
  script: {
    canInstall: true,
    canLookupLatestVersion: false,
    canUninstall: false,
    canUpdate: false,
    lifecycle: 'unmanaged',
  },
  winget: {
    canInstall: true,
    canLookupLatestVersion: false,
    canUninstall: true,
    canUpdate: true,
    lifecycle: 'managed',
  },
}

export function getInstallerCapabilities(type: InstallType): InstallerCapabilities {
  return INSTALLER_CAPABILITIES[type]
}

export function isManagedInstallType(type: InstallType): type is ManagedInstallType {
  return getInstallerCapabilities(type).lifecycle === 'managed'
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
