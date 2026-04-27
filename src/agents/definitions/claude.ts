import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, scriptInstall, wingetInstall } from '../methods'

export const claude: AgentDefinition = {
  name: 'claude',
  displayName: 'Claude Code',
  homepage: 'https://code.claude.com/docs',
  packages: {
    npm: '@anthropic-ai/claude-code',
  },
  binaryName: 'claude',
  selfUpdate: {
    command: ['claude', 'update'],
    fallbackCommands: [['claude', 'upgrade']],
  },
  platforms: {
    windows: [
      bunInstall(),
      npmInstall(),
      scriptInstall('irm https://claude.ai/install.ps1 | iex'),
      wingetInstall('Anthropic.ClaudeCode'),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://claude.ai/install.sh | bash'),
      brewInstall('claude-code', 'cask'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      scriptInstall('curl -fsSL https://claude.ai/install.sh | bash'),
      brewInstall('claude-code', 'cask'),
    ],
  },
}
