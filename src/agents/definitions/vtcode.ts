import type { AgentDefinition } from '../types'
import { brewInstall, cargoInstall, scriptInstall } from '../methods'

export const vtcode: AgentDefinition = {
  name: 'vtcode',
  displayName: 'VTCode',
  homepage: 'https://github.com/vinhnx/vtcode',
  packages: {
    cargo: 'vtcode',
  },
  binaryName: 'vtcode',
  selfUpdate: {
    command: ['vtcode', 'update'],
  },
  versionProbe: {
    command: ['vtcode', '--version'],
  },
  platforms: {
    windows: [
      scriptInstall('irm https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.ps1 | iex'),
      cargoInstall(),
    ],
    macos: [
      scriptInstall('curl -fsSL https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh | bash'),
      cargoInstall(),
      brewInstall('vtcode'),
    ],
    linux: [
      scriptInstall('curl -fsSL https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh | bash'),
      cargoInstall(),
      brewInstall('vtcode'),
    ],
  },
}
