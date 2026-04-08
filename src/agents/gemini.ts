import type { AgentDefinition } from './types'

export const gemini: AgentDefinition = {
  name: 'gemini',
  aliases: ['gemini'],
  displayName: 'Gemini CLI',
  description: 'Google 开源 AI 编程助手 CLI',
  homepage: 'https://geminicli.com',
  package: '@google/gemini-cli',
  binaryName: 'gemini',
  platforms: {
    windows: [
      { type: 'bun', command: 'bun add -g @google/gemini-cli', priority: 1 },
      { type: 'npm', command: 'npm i -g @google/gemini-cli', priority: 2 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g @google/gemini-cli', priority: 1 },
      { type: 'npm', command: 'npm i -g @google/gemini-cli', priority: 2 },
      { type: 'brew', command: 'brew install gemini-cli', packageName: 'gemini-cli', priority: 3 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g @google/gemini-cli', priority: 1 },
      { type: 'npm', command: 'npm i -g @google/gemini-cli', priority: 2 },
      { type: 'brew', command: 'brew install gemini-cli', packageName: 'gemini-cli', priority: 3 },
    ],
  },
}
