import type { AgentDefinition } from '../types'
import { brewInstall, scriptInstall } from '../methods'

export const goose: AgentDefinition = {
  name: 'goose',
  displayName: 'Goose',
  homepage: 'https://github.com/aaif-goose/goose',
  binaryName: 'goose',
  selfUpdate: {
    command: ['goose', 'update'],
  },
  versionProbe: {
    command: ['goose', '--version'],
  },
  platforms: {
    windows: [
      scriptInstall('curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash'),
      scriptInstall(
        'Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aaif-goose/goose/main/download_cli.ps1" -OutFile "download_cli.ps1"; ./download_cli.ps1',
      ),
    ],
    macos: [
      scriptInstall('curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash'),
      brewInstall('block-goose-cli'),
    ],
    linux: [
      scriptInstall('curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash'),
      brewInstall('block-goose-cli'),
    ],
  },
}
