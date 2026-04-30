import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from '../methods'

export const junie: AgentDefinition = {
  name: 'junie',
  displayName: 'Junie CLI',
  homepage: 'https://junie.jetbrains.com/docs/junie-cli.html',
  packages: {
    npm: '@jetbrains/junie',
  },
  binaryName: 'junie',
  versionProbe: {
    command: ['junie', '--version'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall(), scriptInstall("iex (irm 'https://junie.jetbrains.com/install.ps1')")],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://junie.jetbrains.com/install.sh | bash'),
      brewInstall('jetbrains-junie/junie/junie'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://junie.jetbrains.com/install.sh | bash'),
      brewInstall('jetbrains-junie/junie/junie'),
    ],
  },
}
