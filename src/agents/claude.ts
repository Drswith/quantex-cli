import type { AgentDefinition } from './types'
import { brewInstall, bunInstall, npmInstall, scriptInstall, wingetInstall } from './methods'

export const claude: AgentDefinition = {
  name: 'claude',
  aliases: ['claude'],
  displayName: 'Claude Code',
  description: 'Anthropic 官方 AI 编程助手 CLI',
  homepage: 'https://code.claude.com/docs',
  packages: {
    npm: '@anthropic-ai/claude-code',
  },
  binaryName: 'claude',
  platforms: {
    windows: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'irm https://claude.ai/install.ps1 | iex'),
      wingetInstall(4, 'Anthropic.ClaudeCode'),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://claude.ai/install.sh | bash'),
      brewInstall(4, 'claude-code', 'cask'),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
      scriptInstall(3, 'curl -fsSL https://claude.ai/install.sh | bash'),
      brewInstall(4, 'claude-code', 'cask'),
    ],
  },
}
