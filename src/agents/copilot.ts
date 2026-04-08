import type { AgentDefinition } from './types'

export const copilot: AgentDefinition = {
  name: 'copilot',
  aliases: ['copilot'],
  displayName: 'GitHub Copilot CLI',
  description: 'GitHub Copilot 命令行工具',
  homepage: 'https://github.com/features/copilot/cli',
  package: '@github/copilot',
  binaryName: 'copilot',
  platforms: {
    windows: [
      { type: 'winget', command: 'winget install --id GitHub.Copilot -e', packageName: 'GitHub.Copilot', packageTargetKind: 'id', priority: 3 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g @github/copilot', priority: 1 },
      { type: 'npm', command: 'npm i -g @github/copilot', priority: 2 },
      { type: 'script', command: 'curl -fsSL https://gh.io/copilot-install | bash', priority: 3 },
      { type: 'brew', command: 'brew install copilot-cli', packageName: 'copilot-cli', priority: 4 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g @github/copilot', priority: 1 },
      { type: 'npm', command: 'npm i -g @github/copilot', priority: 2 },
      { type: 'script', command: 'curl -fsSL https://gh.io/copilot-install | bash', priority: 3 },
      { type: 'brew', command: 'brew install copilot-cli', packageName: 'copilot-cli', priority: 4 },
    ],
  },
}
