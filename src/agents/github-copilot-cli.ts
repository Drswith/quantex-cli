import type { AgentDefinition, Platform } from './types'

export const githubCopilotCli: AgentDefinition = {
  name: 'github-copilot-cli',
  aliases: ['copilot', 'gh-copilot'],
  displayName: 'GitHub Copilot CLI',
  description: 'GitHub Copilot 命令行工具',
  package: '@github/copilot',
  binaryName: 'copilot',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g @github/copilot',
      supportedPlatforms: ['macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g @github/copilot',
      supportedPlatforms: ['macos', 'linux'],
      priority: 2,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'macos': return 'curl -fsSL https://gh.io/copilot-install | bash'
          case 'linux': return 'curl -fsSL https://gh.io/copilot-install | bash'
          case 'windows': return 'winget install GitHub.Copilot'
        }
      },
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 3,
    },
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'macos': return 'brew install copilot-cli'
          case 'linux': return 'brew install copilot-cli'
          case 'windows': return ''
        }
      },
      supportedPlatforms: ['macos', 'linux'],
      priority: 4,
    },
  ],
}
