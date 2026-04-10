import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from '../methods'

export const droid: AgentDefinition = {
  name: 'droid',
  displayName: 'Droid',
  description: 'Factory AI 软件工程 Agent CLI',
  homepage: 'https://docs.factory.ai/cli/getting-started/overview',
  packages: {
    npm: 'droid',
  },
  binaryName: 'droid',
  platforms: {
    windows: [
      bunInstall(),
      npmInstall(),
      scriptInstall('irm https://app.factory.ai/cli/windows | iex'),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://app.factory.ai/cli | sh'),
      brewInstall('droid', 'cask'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://app.factory.ai/cli | sh'),
      brewInstall('droid', 'cask'),
    ],
  },
}
