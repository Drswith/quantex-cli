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
          case 'windows': return 'irm https://claude.ai/install.ps1 | iex'
          case 'macos': return 'curl -fsSL https://claude.ai/install.sh | bash'
          case 'linux': return 'curl -fsSL https://claude.ai/install.sh | bash'
        }
      },
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 3,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'windows': return 'winget install Anthropic.ClaudeCode'
          case 'macos': return 'brew install --cask claude-code'
          case 'linux': return 'brew install --cask claude-code'
        }
      },
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 4,
    },
  ],
}
