import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall, wingetInstall } from '../methods'

export const copilot: AgentDefinition = {
  name: 'copilot',
  displayName: 'GitHub Copilot CLI',
  homepage: 'https://github.com/features/copilot/cli',
  packages: {
    npm: '@github/copilot',
  },
  binaryName: 'copilot',
  platforms: {
    windows: [
      wingetInstall('GitHub.Copilot'),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://gh.io/copilot-install | bash'),
      brewInstall('copilot-cli'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://gh.io/copilot-install | bash'),
      brewInstall('copilot-cli'),
    ],
  },
}
