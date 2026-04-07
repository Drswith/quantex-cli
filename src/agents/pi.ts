import type { AgentDefinition } from './types'

export const pi: AgentDefinition = {
  name: 'pi',
  aliases: ['pi'],
  displayName: 'Pi',
  description: '极简可扩展的终端编程 Agent',
  homepage: 'https://pi.dev',
  package: '@mariozechner/pi-coding-agent',
  binaryName: 'pi',
  platforms: {
    windows: [
      { type: 'bun', command: 'bun add -g @mariozechner/pi-coding-agent', priority: 1 },
      { type: 'npm', command: 'npm i -g @mariozechner/pi-coding-agent', priority: 2 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g @mariozechner/pi-coding-agent', priority: 1 },
      { type: 'npm', command: 'npm i -g @mariozechner/pi-coding-agent', priority: 2 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g @mariozechner/pi-coding-agent', priority: 1 },
      { type: 'npm', command: 'npm i -g @mariozechner/pi-coding-agent', priority: 2 },
    ],
  },
}
