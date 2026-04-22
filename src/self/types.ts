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

export interface SelfUpdateResult {
  installSource: SelfInstallSource
  success: boolean
}

export interface SelfPackageMetadata {
  foundPackageJson: boolean
  packageJsonPath: string
  packageRoot: string
  version: string
}
