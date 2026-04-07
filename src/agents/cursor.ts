import type { AgentDefinition } from './types'

export const cursor: AgentDefinition = {
  name: 'cursor',
  aliases: ['cursor', 'agent'],
  displayName: 'Cursor CLI',
  description: 'Cursor AI 编程助手命令行工具',
  homepage: 'https://cursor.com/docs/cli',
  package: '',
  binaryName: 'agent',
  platforms: {
    windows: [
      { type: 'binary', command: 'irm \'https://cursor.com/install?win32=true\' | iex', priority: 1 },
    ],
    macos: [
      { type: 'binary', command: 'curl https://cursor.com/install -fsS | bash', priority: 1 },
    ],
    linux: [
      { type: 'binary', command: 'curl https://cursor.com/install -fsS | bash', priority: 1 },
    ],
  },
}
