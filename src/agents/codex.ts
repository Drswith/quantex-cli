import type { AgentDefinition } from './types'
import { brewInstall, bunInstall, npmInstall } from './methods'

export const codex: AgentDefinition = {
  name: 'codex',
  aliases: ['codex'],
  displayName: 'Codex CLI',
  description: 'OpenAI 官方 AI 编程助手 CLI',
  homepage: 'https://developers.openai.com/codex',
  packages: {
    npm: '@openai/codex',
  },
  binaryName: 'codex',
  platforms: {
    windows: [
      bunInstall(1),
      npmInstall(2),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
      brewInstall(3, 'codex'),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
      brewInstall(3, 'codex'),
    ],
  },
}
