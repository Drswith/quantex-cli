import type { AgentDefinition } from './types'
import { brewInstall, bunInstall, npmInstall, scriptInstall, wingetInstall } from './methods'

export const copilot: AgentDefinition = {
  name: 'copilot',
  aliases: ['copilot'],
  displayName: 'GitHub Copilot CLI',
  description: 'GitHub Copilot 命令行工具',
  homepage: 'https://github.com/features/copilot/cli',
  packages: {
    npm: '@github/copilot',
  },
  binaryName: 'copilot',
  platforms: {
    windows: [
      wingetInstall(3, 'GitHub.Copilot'),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://gh.io/copilot-install | bash'),
      brewInstall(4, 'copilot-cli'),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://gh.io/copilot-install | bash'),
      brewInstall(4, 'copilot-cli'),
    ],
  },
}
