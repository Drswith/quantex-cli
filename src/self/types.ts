export type SelfInstallSource = 'binary' | 'bun' | 'npm' | 'source' | 'unknown'
export type SelfUpdateChannel = 'beta' | 'stable'

export interface SelfInspection {
  canAutoUpdate: boolean
  currentVersion: string
  executablePath: string
  installSource: SelfInstallSource
  latestVersion?: string
  managedRegistry?: string
  managedRegistryIsOverride?: boolean
  packageRoot: string
  recommendedUpgradeCommand?: string
  upstreamLatestVersion?: string
  updateChannel: SelfUpdateChannel
}

export type SelfUpgradeErrorKind =
  | 'checksum'
  | 'locked'
  | 'network'
  | 'permission'
  | 'unknown'
  | 'unsupported'
  | 'verify'

export interface SelfUpgradeError {
  detail?: unknown
  kind: SelfUpgradeErrorKind
  message: string
}

export interface SelfUpdateResult {
  error?: SelfUpgradeError
  installSource: SelfInstallSource
  newVersion?: string
  success: boolean
}

export interface SelfPackageMetadata {
  foundPackageJson: boolean
  packageJsonPath: string
  packageRoot: string
  version: string
}
