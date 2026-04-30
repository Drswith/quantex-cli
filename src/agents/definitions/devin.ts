import type { AgentDefinition } from '../types'
import { scriptInstall } from '../methods'

export const devin: AgentDefinition = {
  name: 'devin',
  displayName: 'Devin for Terminal',
  homepage: 'https://cli.devin.ai/',
  binaryName: 'devin',
  selfUpdate: {
    command: ['devin', 'update'],
  },
  versionProbe: {
    command: ['devin', 'version'],
  },
  platforms: {
    windows: [scriptInstall('irm https://static.devin.ai/cli/setup.ps1 | iex')],
    macos: [scriptInstall('curl -fsSL https://cli.devin.ai/install.sh | bash')],
    linux: [scriptInstall('curl -fsSL https://cli.devin.ai/install.sh | bash')],
  },
}
