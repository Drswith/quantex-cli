import type { AgentDefinition } from '../types'
import { scriptInstall } from '../methods'

export const cursor: AgentDefinition = {
  name: 'cursor',
  lookupAliases: ['agent'],
  displayName: 'Cursor CLI',
  homepage: 'https://cursor.com/docs/cli',
  binaryName: 'agent',
  selfUpdate: {
    command: ['agent', 'update'],
  },
  versionProbe: {
    command: ['agent', '--version'],
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
