import type { AgentDefinition } from '../types'
import { brewInstall, scriptInstall } from '../methods'

export const kimi: AgentDefinition = {
  name: 'kimi',
  lookupAliases: ['kimi-code', 'kimi-cli'],
  displayName: 'Kimi Code',
  homepage: 'https://moonshotai.github.io/kimi-cli/',
  binaryName: 'kimi',
  selfUpdate: {
    command: ['uv', 'tool', 'upgrade', 'kimi-cli', '--no-cache'],
  },
  versionProbe: {
    command: ['kimi', '--version'],
  },
  platforms: {
    windows: [scriptInstall('irm https://code.kimi.com/install.ps1 | iex')],
    macos: [scriptInstall('curl -LsSf https://code.kimi.com/install.sh | bash'), brewInstall('kimi-cli')],
    linux: [scriptInstall('curl -LsSf https://code.kimi.com/install.sh | bash'), brewInstall('kimi-cli')],
  },
}
