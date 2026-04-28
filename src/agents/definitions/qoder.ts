import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from '../methods'

export const qoder: AgentDefinition = {
  name: 'qoder',
  displayName: 'Qoder CLI',
  homepage: 'https://docs.qoder.com/cli/quick-start',
  packages: {
    npm: '@qoder-ai/qodercli',
  },
  binaryName: 'qodercli',
  selfUpdate: {
    command: ['qodercli', 'update'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall()],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://qoder.com/install | bash'),
      brewInstall('qoderai/qoder/qodercli', 'cask'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://qoder.com/install | bash'),
      brewInstall('qoderai/qoder/qodercli', 'cask'),
    ],
  },
}
