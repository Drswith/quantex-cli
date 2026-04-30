import type { AgentDefinition } from '../types'
import { bunInstall, npmInstall } from '../methods'

export const auggie: AgentDefinition = {
  name: 'auggie',
  displayName: 'Auggie CLI',
  homepage: 'https://docs.augmentcode.com/cli/overview',
  packages: {
    npm: '@augmentcode/auggie',
  },
  binaryName: 'auggie',
  selfUpdate: {
    command: ['auggie', 'upgrade'],
  },
  versionProbe: {
    command: ['auggie', '--version'],
  },
  platforms: {
    macos: [bunInstall(), npmInstall()],
    linux: [bunInstall(), npmInstall()],
  },
}
