import type { AgentDefinition } from './types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from './methods'

export const opencode: AgentDefinition = {
  name: 'opencode',
  aliases: ['opencode'],
  displayName: 'OpenCode',
  description: '开源 AI 编程 CLI',
  homepage: 'https://opencode.ai',
  packages: {
    npm: 'opencode-ai',
  },
  binaryName: 'opencode',
  platforms: {
    windows: [
      bunInstall(1),
      npmInstall(2),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://opencode.ai/install | bash'),
      brewInstall(4, 'anomalyco/tap/opencode'),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://opencode.ai/install | bash'),
      brewInstall(4, 'anomalyco/tap/opencode'),
    ],
  },
}
