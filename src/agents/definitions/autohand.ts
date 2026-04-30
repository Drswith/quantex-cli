import type { AgentDefinition } from '../types'
import { scriptInstall } from '../methods'

export const autohand: AgentDefinition = {
  name: 'autohand',
  lookupAliases: ['autohand-cli'],
  displayName: 'Autohand Code CLI',
  homepage: 'https://autohand.ai/cli/',
  packages: {
    npm: 'autohand-cli',
  },
  binaryName: 'autohand',
  versionProbe: {
    command: ['autohand', '--version'],
  },
  platforms: {
    windows: [scriptInstall('iwr -useb https://autohand.ai/install.ps1 | iex')],
    macos: [scriptInstall('curl -fsSL https://autohand.ai/install.sh | bash')],
    linux: [scriptInstall('curl -fsSL https://autohand.ai/install.sh | bash')],
  },
}
