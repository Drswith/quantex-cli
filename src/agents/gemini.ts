import type { AgentDefinition } from './types'
import { brewInstall, bunInstall, npmInstall } from './methods'

export const gemini: AgentDefinition = {
  name: 'gemini',
  aliases: ['gemini'],
  displayName: 'Gemini CLI',
  description: 'Google 开源 AI 编程助手 CLI',
  homepage: 'https://geminicli.com',
  packages: {
    npm: '@google/gemini-cli',
  },
  binaryName: 'gemini',
  platforms: {
    windows: [
      bunInstall(1),
      npmInstall(2),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
      brewInstall(3, 'gemini-cli'),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
      brewInstall(3, 'gemini-cli'),
    ],
  },
}
