import type { AgentDefinition } from '../types'
import { scriptInstall } from '../methods'

export const tabnine: AgentDefinition = {
  name: 'tabnine',
  lookupAliases: ['tabnine-cli'],
  displayName: 'Tabnine CLI',
  homepage: 'https://www.tabnine.com/platform-cli/',
  binaryName: 'tabnine',
  selfUpdate: {
    command: ['tabnine', 'update'],
  },
  versionProbe: {
    command: ['tabnine', '--version'],
  },
  platforms: {
    windows: [
      scriptInstall(
        'irm https://console.tabnine.com/update/cli/installer.mjs | node --input-type=module - https://console.tabnine.com',
      ),
    ],
    macos: [
      scriptInstall(
        'curl -fsSL https://console.tabnine.com/update/cli/installer.mjs | node --input-type=module - https://console.tabnine.com',
      ),
    ],
    linux: [
      scriptInstall(
        'curl -fsSL https://console.tabnine.com/update/cli/installer.mjs | node --input-type=module - https://console.tabnine.com',
      ),
    ],
  },
}
