import type { AgentDefinition, Platform } from './types'

export const gemini: AgentDefinition = {
  name: 'gemini',
  aliases: [],
  displayName: 'Gemini CLI',
  description: 'Google 开源 AI 编程助手 CLI',
  homepage: 'https://geminicli.com',
  package: '@google/gemini-cli',
  binaryName: 'gemini',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g @google/gemini-cli',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g @google/gemini-cli',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'macos': return 'brew install gemini-cli'
          case 'linux': return 'brew install gemini-cli'
          case 'windows': return ''
        }
      },
      supportedPlatforms: ['macos', 'linux'],
      priority: 3,
    },
  ],
}
