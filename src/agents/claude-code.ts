import type { AgentDefinition } from './types'

export const claudeCode: AgentDefinition = {
  name: 'claude-code',
  aliases: ['claude'],
  displayName: 'Claude Code',
  description: 'Anthropic 官方 AI 编程助手 CLI',
  homepage: 'https://code.claude.com/docs',
  package: '@anthropic-ai/claude-code',
  binaryName: 'claude',
  platforms: {
    windows: [
      { type: 'bun', command: 'bun add -g @anthropic-ai/claude-code', priority: 1 },
      { type: 'npm', command: 'npm i -g @anthropic-ai/claude-code', priority: 2 },
      { type: 'binary', command: 'irm https://claude.ai/install.ps1 | iex', priority: 3 },
      { type: 'binary', command: 'winget install Anthropic.ClaudeCode', priority: 4 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g @anthropic-ai/claude-code', priority: 1 },
      { type: 'npm', command: 'npm i -g @anthropic-ai/claude-code', priority: 2 },
      { type: 'binary', command: 'curl -fsSL https://claude.ai/install.sh | bash', priority: 3 },
      { type: 'binary', command: 'brew install --cask claude-code', priority: 4 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g @anthropic-ai/claude-code', priority: 1 },
      { type: 'npm', command: 'npm i -g @anthropic-ai/claude-code', priority: 2 },
      { type: 'binary', command: 'curl -fsSL https://claude.ai/install.sh | bash', priority: 3 },
      { type: 'binary', command: 'brew install --cask claude-code', priority: 4 },
    ],
  },
}
