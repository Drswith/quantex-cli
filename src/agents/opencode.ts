import type { AgentDefinition, Platform } from './types'

export const opencode: AgentDefinition = {
  name: 'opencode',
  aliases: ['opencode'],
  displayName: 'OpenCode',
  description: '开源 AI 编程 CLI',
  package: 'opencode-ai',
  binaryName: 'opencode',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g opencode-ai',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g opencode-ai',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'macos': return 'curl -fsSL https://opencode.ai/install | bash'
          case 'linux': return 'curl -fsSL https://opencode.ai/install | bash'
          case 'windows': return ''
        }
      },
      supportedPlatforms: ['macos', 'linux'],
      priority: 3,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'macos': return 'brew install anomalyco/tap/opencode'
          case 'linux': return 'brew install anomalyco/tap/opencode'
          case 'windows': return ''
        }
      },
      supportedPlatforms: ['macos', 'linux'],
      priority: 4,
    },
  ],
}
