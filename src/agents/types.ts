export type Platform = 'windows' | 'macos' | 'linux'

export interface InstallMethod {
  type: 'bun' | 'npm' | 'binary'
  command: string | ((platform: Platform) => string)
  supportedPlatforms: Platform[]
  priority: number
}

export interface AgentDefinition {
  name: string
  aliases: string[]
  displayName: string
  description: string
  homepage: string
  package: string
  installMethods: InstallMethod[]
  binaryName: string
}
