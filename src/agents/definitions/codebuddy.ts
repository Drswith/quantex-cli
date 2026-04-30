import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall } from '../methods'

export const codebuddy: AgentDefinition = {
  name: 'codebuddy',
  lookupAliases: ['codebuddy-code'],
  displayName: 'CodeBuddy Code',
  homepage: 'https://www.codebuddy.cn/docs/cli/installation',
  packages: {
    npm: '@tencent-ai/codebuddy-code',
  },
  binaryName: 'codebuddy',
  selfUpdate: {
    command: ['codebuddy', 'update'],
  },
  versionProbe: {
    command: ['codebuddy', '--version'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall(), scriptInstall('irm https://www.codebuddy.cn/cli/install.ps1 | iex')],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://www.codebuddy.cn/cli/install.sh | bash'),
      brewInstall('Tencent-CodeBuddy/tap/codebuddy-code'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://www.codebuddy.cn/cli/install.sh | bash'),
      brewInstall('Tencent-CodeBuddy/tap/codebuddy-code'),
    ],
  },
}
