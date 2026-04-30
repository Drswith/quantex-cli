import type { AgentDefinition } from '../types'
import { brewInstall, scriptInstall } from '../methods'

export const goose: AgentDefinition = {
  name: 'goose',
  displayName: 'Goose',
  homepage: 'https://github.com/block/goose',
  binaryName: 'goose',
  selfUpdate: {
    command: ['goose', 'update'],
  },
  versionProbe: {
    command: ['goose', '--version'],
  },
  platforms: {
    windows: [
      scriptInstall('curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash'),
      scriptInstall(
        'Invoke-WebRequest -Uri "https://raw.githubusercontent.com/block/goose/main/download_cli.ps1" -OutFile "download_cli.ps1"; ./download_cli.ps1',
      ),
    ],
    macos: [
      scriptInstall('curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash'),
      brewInstall('block-goose-cli'),
    ],
    linux: [
      scriptInstall('curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash'),
      brewInstall('block-goose-cli'),
    ],
  },
}
