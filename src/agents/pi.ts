import type { AgentDefinition } from './types'

export const pi: AgentDefinition = {
  name: 'pi',
  aliases: ['pi'],
  displayName: 'Pi',
  description: '极简可扩展的终端编程 Agent',
  package: '@mariozechner/pi-coding-agent',
  binaryName: 'pi',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g @mariozechner/pi-coding-agent',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g @mariozechner/pi-coding-agent',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
  ],
}
