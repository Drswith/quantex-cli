import type { AgentDefinition, Platform } from './types'

export const claudeCode: AgentDefinition = {
  name: 'claude-code',
  aliases: ['claude'],
  displayName: 'Claude Code',
  description: 'Anthropic 官方 AI 编程助手 CLI',
  package: '@anthropic-ai/claude-code',
  binaryName: 'claude',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g @anthropic-ai/claude-code',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g @anthropic-ai/claude-code',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'windows': return 'irm https://claude-setup.com/install.ps1 | iex'
          case 'macos': return 'brew install --cask claude-code'
          case 'linux': return 'curl -fsSL https://claude-setup.com/install.sh | sh'
        }
      },
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 3,
    },
  ],
}
