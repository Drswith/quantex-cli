import type { AgentDefinition } from './types'

export const opencode: AgentDefinition = {
  name: 'opencode',
  aliases: ['opencode'],
  displayName: 'OpenCode',
  description: '开源 AI 编程 CLI',
  homepage: 'https://opencode.ai',
  package: 'opencode-ai',
  binaryName: 'opencode',
  platforms: {
    windows: [
      { type: 'bun', command: 'bun add -g opencode-ai', priority: 1 },
      { type: 'npm', command: 'npm i -g opencode-ai', priority: 2 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g opencode-ai', priority: 1 },
      { type: 'npm', command: 'npm i -g opencode-ai', priority: 2 },
      { type: 'script', command: 'curl -fsSL https://opencode.ai/install | bash', priority: 3 },
      { type: 'brew', command: 'brew install anomalyco/tap/opencode', packageName: 'anomalyco/tap/opencode', priority: 4 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g opencode-ai', priority: 1 },
      { type: 'npm', command: 'npm i -g opencode-ai', priority: 2 },
      { type: 'script', command: 'curl -fsSL https://opencode.ai/install | bash', priority: 3 },
      { type: 'brew', command: 'brew install anomalyco/tap/opencode', packageName: 'anomalyco/tap/opencode', priority: 4 },
    ],
  },
}
