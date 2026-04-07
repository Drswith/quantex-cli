import type { AgentDefinition } from './types'

export const opencode: AgentDefinition = {
  name: 'opencode',
  aliases: ['opencode'],
  displayName: 'OpenCode',
  description: '开源 AI 编程 CLI',
  package: 'opencode',
  binaryName: 'opencode',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g opencode',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g opencode',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
  ],
}
