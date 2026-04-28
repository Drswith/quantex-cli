import type { AgentDefinition } from '../types'
import { bunInstall, npmInstall } from '../methods'

export const kilo: AgentDefinition = {
  name: 'kilo',
  lookupAliases: ['kilocode'],
  displayName: 'Kilo Code CLI',
  homepage: 'https://kilo.ai/docs/cli',
  packages: {
    npm: '@kilocode/cli',
  },
  binaryName: 'kilo',
  selfUpdate: {
    command: ['kilo', 'upgrade'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall()],
    macos: [bunInstall(), npmInstall()],
    linux: [bunInstall(), npmInstall()],
  },
}
