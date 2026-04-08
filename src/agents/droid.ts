import type { AgentDefinition } from './types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from './methods'

export const droid: AgentDefinition = {
  name: 'droid',
  aliases: ['droid'],
  displayName: 'Droid',
  description: 'Factory AI 软件工程 Agent CLI',
  homepage: 'https://docs.factory.ai/cli/getting-started/overview',
  packages: {
    npm: 'droid',
  },
  binaryName: 'droid',
  platforms: {
    windows: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'irm https://app.factory.ai/cli/windows | iex'),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://app.factory.ai/cli | sh'),
      brewInstall(4, 'droid', 'cask'),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://app.factory.ai/cli | sh'),
      brewInstall(4, 'droid', 'cask'),
    ],
  },
}
