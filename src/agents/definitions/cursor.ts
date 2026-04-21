import type { AgentDefinition } from '../types'
import { scriptInstall } from '../methods'

export const cursor: AgentDefinition = {
  name: 'cursor',
  lookupAliases: ['agent'],
  displayName: 'Cursor CLI',
  description: 'Cursor AI 编程助手命令行工具',
  homepage: 'https://cursor.com/docs/cli',
  binaryName: 'agent',
  update: {
    commands: ['agent update'],
  },
  platforms: {
    windows: [
      scriptInstall('irm \'https://cursor.com/install?win32=true\' | iex'),
    ],
    macos: [
      scriptInstall('curl https://cursor.com/install -fsS | bash'),
    ],
    linux: [
      scriptInstall('curl https://cursor.com/install -fsS | bash'),
    ],
  },
}
