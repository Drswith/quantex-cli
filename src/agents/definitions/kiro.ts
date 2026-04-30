import type { AgentDefinition } from '../types'
import { scriptInstall, wingetInstall } from '../methods'

export const kiro: AgentDefinition = {
  name: 'kiro',
  lookupAliases: ['kiro-cli'],
  displayName: 'Kiro CLI',
  homepage: 'https://kiro.dev/cli/',
  binaryName: 'kiro-cli',
  versionProbe: {
    command: ['kiro-cli', '--version'],
  },
  platforms: {
    windows: [scriptInstall("irm 'https://cli.kiro.dev/install.ps1' | iex"), wingetInstall('Amazon.Kiro')],
    macos: [scriptInstall('curl -fsSL https://cli.kiro.dev/install | bash')],
    linux: [scriptInstall('curl -fsSL https://cli.kiro.dev/install | bash')],
  },
}
