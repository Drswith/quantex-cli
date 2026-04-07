import type { AgentDefinition, Platform } from './types'

export const droid: AgentDefinition = {
  name: 'droid',
  aliases: ['droid'],
  displayName: 'Droid',
  description: 'Factory AI 软件工程 Agent CLI',
  homepage: 'https://docs.factory.ai/cli/getting-started/overview',
  package: 'droid',
  binaryName: 'droid',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g droid',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g droid',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'windows': return 'irm https://app.factory.ai/cli/windows | iex'
          case 'macos': return 'curl -fsSL https://app.factory.ai/cli | sh'
          case 'linux': return 'curl -fsSL https://app.factory.ai/cli | sh'
        }
      },
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 3,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'macos': return 'brew install --cask droid'
          case 'linux': return 'brew install --cask droid'
          case 'windows': return ''
        }
      },
      supportedPlatforms: ['macos', 'linux'],
      priority: 4,
    },
  ],
}
