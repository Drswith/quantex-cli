import type { AgentDefinition } from '../types'
import { bunInstall, npmInstall, scriptInstall } from '../methods'

export const forgecode: AgentDefinition = {
  name: 'forgecode',
  lookupAliases: ['forge'],
  displayName: 'ForgeCode',
  homepage: 'https://forgecode.dev',
  packages: {
    npm: 'forgecode',
  },
  binaryName: 'forge',
  selfUpdate: {
    command: ['forge', 'update'],
  },
  versionProbe: {
    command: ['forge', '--version'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall(), scriptInstall('irm https://forgecode.dev/cli | iex')],
    macos: [bunInstall(), npmInstall(), scriptInstall('curl -fsSL https://forgecode.dev/cli | sh')],
    linux: [bunInstall(), npmInstall(), scriptInstall('curl -fsSL https://forgecode.dev/cli | sh')],
  },
}
