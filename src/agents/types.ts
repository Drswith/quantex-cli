export type Platform = 'windows' | 'macos' | 'linux'

export type ManagedInstallType = 'bun' | 'npm' | 'brew' | 'winget'
export type InstallType = ManagedInstallType | 'script' | 'binary'
export type PackageTargetKind = 'package' | 'cask' | 'id'

interface BaseInstallMethod {
  command?: string
  packageName?: string
  packageTargetKind?: PackageTargetKind
}

export interface ManagedInstallMethod extends BaseInstallMethod {
  command?: never
  type: ManagedInstallType
}

export interface ScriptInstallMethod extends BaseInstallMethod {
  command: string
  type: 'script'
}

export interface BinaryInstallMethod extends BaseInstallMethod {
  command: string
  type: 'binary'
}

export type InstallMethod = ManagedInstallMethod | ScriptInstallMethod | BinaryInstallMethod

export interface AgentPackageMetadata {
  npm?: string
}

export interface AgentDefinition {
  name: string
  aliases: string[]
  displayName: string
  description: string
  homepage: string
  packages?: AgentPackageMetadata
  platforms: Partial<Record<Platform, InstallMethod[]>>
  binaryName: string
}
