import type { AgentDefinition } from '../types'
import { npmInstall } from '../methods'

export const deepseek: AgentDefinition = {
  name: 'deepseek',
  lookupAliases: ['deepseek-tui'],
  displayName: 'DeepSeek TUI',
  homepage: 'https://github.com/Hmbown/DeepSeek-TUI',
  packages: {
    npm: 'deepseek-tui',
  },
  binaryName: 'deepseek',
  selfUpdate: {
    command: ['deepseek', 'update'],
  },
  versionProbe: {
    command: ['deepseek', '--version'],
  },
  platforms: {
    windows: [npmInstall()],
    macos: [npmInstall()],
    linux: [npmInstall()],
  },
}
