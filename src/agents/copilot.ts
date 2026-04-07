import type { AgentDefinition } from './types'

export const copilot: AgentDefinition = {
  name: 'copilot',
  aliases: ['gh-copilot'],
  displayName: 'GitHub Copilot CLI',
  description: 'GitHub Copilot 命令行工具',
  homepage: 'https://github.com/features/copilot/cli',
  package: '@github/copilot',
  binaryName: 'copilot',
  platforms: {
    windows: [
      { type: 'binary', command: 'winget install GitHub.Copilot', priority: 3 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g @github/copilot', priority: 1 },
      { type: 'npm', command: 'npm i -g @github/copilot', priority: 2 },
      { type: 'binary', command: 'curl -fsSL https://gh.io/copilot-install | bash', priority: 3 },
      { type: 'binary', command: 'brew install copilot-cli', priority: 4 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g @github/copilot', priority: 1 },
      { type: 'npm', command: 'npm i -g @github/copilot', priority: 2 },
      { type: 'binary', command: 'curl -fsSL https://gh.io/copilot-install | bash', priority: 3 },
      { type: 'binary', command: 'brew install copilot-cli', priority: 4 },
    ],
  },
}
