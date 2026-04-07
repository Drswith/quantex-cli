export type Platform = 'windows' | 'macos' | 'linux'

export type InstallType = 'bun' | 'npm' | 'binary'

export interface InstallMethod {
  type: InstallType
  command: string
  priority: number
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
