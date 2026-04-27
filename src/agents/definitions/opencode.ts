import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from '../methods'

export const opencode: AgentDefinition = {
  name: 'opencode',
  displayName: 'OpenCode',
  homepage: 'https://opencode.ai',
  packages: {
    npm: 'opencode-ai',
  },
  binaryName: 'opencode',
  selfUpdate: {
    command: ['opencode', 'upgrade'],
  },
  platforms: {
    windows: [
      bunInstall(),
      npmInstall(),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://opencode.ai/install | bash'),
      brewInstall('anomalyco/tap/opencode'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://opencode.ai/install | bash'),
      brewInstall('anomalyco/tap/opencode'),
    ],
  },
}
