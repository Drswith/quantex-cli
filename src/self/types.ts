export type SelfInstallSource = 'binary' | 'bun' | 'npm' | 'source' | 'unknown'

export interface SelfInspection {
  canAutoUpdate: boolean
  currentVersion: string
  executablePath: string
  installSource: SelfInstallSource
  latestVersion?: string
  packageRoot: string
  recommendedUpgradeCommand?: string
}

export type SelfUpgradeErrorKind = 'checksum' | 'locked' | 'network' | 'permission' | 'unknown' | 'unsupported' | 'verify'

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
