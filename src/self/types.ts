import type { BinaryReleaseAsset } from './release'

export type SelfInstallSource = 'binary' | 'bun' | 'npm' | 'source' | 'unknown'
export type SelfUpdateChannel = 'beta' | 'stable'
export type SelfUpgradePlanStatus = 'check-unavailable' | 'manual-required' | 'up-to-date' | 'update-available'

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

export interface SelfInstallFacts {
  canAutoUpdate: boolean
  currentVersion: string
  executablePath: string
  installSource: SelfInstallSource
  packageRoot: string
  updateChannel: SelfUpdateChannel
}

export interface SelfUpdateTarget {
  binaryAsset?: BinaryReleaseAsset
  managedRegistry?: string
  managedRegistryIsOverride?: boolean
  packageTag?: 'beta' | 'latest'
  resolutionError?: SelfUpgradeError
  targetVersion?: string
  upstreamLatestVersion?: string
  verificationCommand?: string[]
}

export interface SelfUpgradePlan {
  facts: SelfInstallFacts
  status: SelfUpgradePlanStatus
  target: SelfUpdateTarget
  updateAvailable: boolean
}
