import type { AgentDefinition } from '../types'
import { bunInstall, npmInstall } from '../methods'

export const amp: AgentDefinition = {
  name: 'amp',
  displayName: 'Amp',
  homepage: 'https://ampcode.com/',
  packages: {
    npm: '@sourcegraph/amp',
  },
  binaryName: 'amp',
  selfUpdate: {
    command: ['amp', 'update'],
  },
  versionProbe: {
    command: ['amp', 'version'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall()],
    macos: [bunInstall(), npmInstall()],
    linux: [bunInstall(), npmInstall()],
  },
}
