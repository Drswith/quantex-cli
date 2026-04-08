export type Platform = 'windows' | 'macos' | 'linux'

export type ManagedInstallType = 'bun' | 'npm' | 'brew' | 'winget'
export type InstallType = ManagedInstallType | 'script' | 'binary'
export type PackageTargetKind = 'package' | 'cask' | 'id'

export interface InstallMethod {
  type: InstallType
  command: string
  priority: number
  packageName?: string
  packageTargetKind?: PackageTargetKind
}

export interface AgentDefinition {
  name: string
  aliases: string[]
  displayName: string
  description: string
  homepage: string
  package: string
  platforms: Partial<Record<Platform, InstallMethod[]>>
  binaryName: string
}
