import type { AgentDefinition } from '../types'
import { binaryInstall, scriptInstall } from '../methods'

export const openhands: AgentDefinition = {
  name: 'openhands',
  displayName: 'OpenHands CLI',
  homepage: 'https://docs.openhands.dev/openhands/usage/cli/installation',
  binaryName: 'openhands',
  selfUpdate: {
    command: ['uv', 'tool', 'upgrade', 'openhands', '--python', '3.12'],
  },
  versionProbe: {
    command: ['openhands', '--version'],
  },
  platforms: {
    macos: [
      binaryInstall('uv tool install openhands --python 3.12'),
      scriptInstall('curl -fsSL https://install.openhands.dev/install.sh | sh'),
    ],
    linux: [
      binaryInstall('uv tool install openhands --python 3.12'),
      scriptInstall('curl -fsSL https://install.openhands.dev/install.sh | sh'),
    ],
  },
}
