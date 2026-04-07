import type { AgentDefinition, Platform } from './types'

export const cursor: AgentDefinition = {
  name: 'cursor',
  aliases: [],
  displayName: 'Cursor CLI',
  description: 'Cursor AI 编程助手命令行工具',
  homepage: 'https://cursor.com/docs/cli',
  package: '',
  binaryName: 'agent',
  installMethods: [
    {
      type: 'binary',
      command: (platform: Platform) => {
        switch (platform) {
          case 'windows': return 'irm \'https://cursor.com/install?win32=true\' | iex'
          case 'macos': return 'curl https://cursor.com/install -fsS | bash'
          case 'linux': return 'curl https://cursor.com/install -fsS | bash'
        }
      },
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
  ],
}
