import type { AgentDefinition } from '../types'
import { cargoInstall, npmInstall } from '../methods'

export const deepseek: AgentDefinition = {
  name: 'deepseek',
  lookupAliases: ['deepseek-tui'],
  displayName: 'DeepSeek TUI',
  homepage: 'https://github.com/Hmbown/DeepSeek-TUI',
  packages: {
    cargo: 'deepseek-tui-cli',
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
    windows: [npmInstall(), cargoInstall(undefined, ['--locked'])],
    macos: [npmInstall(), cargoInstall(undefined, ['--locked'])],
    linux: [npmInstall(), cargoInstall(undefined, ['--locked'])],
  },
}
