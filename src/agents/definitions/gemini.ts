import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall } from '../methods'

export const gemini: AgentDefinition = {
  name: 'gemini',
  displayName: 'Gemini CLI',
  description: 'Google 开源 AI 编程助手 CLI',
  homepage: 'https://google-gemini.github.io/gemini-cli/docs/',
  packages: {
    npm: '@google/gemini-cli',
  },
  binaryName: 'gemini',
  platforms: {
    windows: [
      bunInstall(),
      npmInstall(),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
      brewInstall('gemini-cli'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      brewInstall('gemini-cli'),
    ],
  },
}
