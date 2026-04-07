import type { AgentDefinition } from './types'

export const codex: AgentDefinition = {
  name: 'codex',
  aliases: ['codex'],
  displayName: 'Codex CLI',
  description: 'OpenAI 官方 AI 编程助手 CLI',
  package: '@openai/codex',
  binaryName: 'codex',
  installMethods: [
    {
      type: 'bun',
      command: 'bun add -g @openai/codex',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 1,
    },
    {
      type: 'npm',
      command: 'npm i -g @openai/codex',
      supportedPlatforms: ['windows', 'macos', 'linux'],
      priority: 2,
    },
  ],
}
