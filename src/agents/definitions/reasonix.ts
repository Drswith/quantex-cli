import type { AgentDefinition } from '../types'
import { npmInstall } from '../methods'

export const reasonix: AgentDefinition = {
  name: 'reasonix',
  lookupAliases: ['deepseek-reasonix'],
  displayName: 'Reasonix',
  homepage: 'https://github.com/esengine/DeepSeek-Reasonix',
  packages: {
    npm: 'reasonix',
  },
  binaryName: 'reasonix',
  selfUpdate: {
    command: ['reasonix', 'update'],
  },
  versionProbe: {
    command: ['reasonix', '--version'],
  },
  platforms: {
    windows: [npmInstall()],
    macos: [npmInstall()],
    linux: [npmInstall()],
  },
}
