import type { AgentDefinition } from '../types'
import { brewInstall, scriptInstall } from '../methods'

export const jcode: AgentDefinition = {
  name: 'jcode',
  displayName: 'jcode CLI',
  homepage: 'https://github.com/1jehuang/jcode',
  binaryName: 'jcode',
  versionProbe: {
    command: ['jcode', '--version'],
  },
  platforms: {
    windows: [scriptInstall('irm https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.ps1 | iex')],
    macos: [
      brewInstall('1jehuang/jcode/jcode'),
      scriptInstall('curl -fsSL https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh | bash'),
    ],
    linux: [
      scriptInstall('curl -fsSL https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh | bash'),
    ],
  },
}
