import type { AgentDefinition } from './types'

export const codex: AgentDefinition = {
  name: 'codex',
  aliases: ['codex'],
  displayName: 'Codex CLI',
  description: 'OpenAI 官方 AI 编程助手 CLI',
  homepage: 'https://developers.openai.com/codex',
  package: '@openai/codex',
  binaryName: 'codex',
  platforms: {
    windows: [
      { type: 'bun', command: 'bun add -g @openai/codex', priority: 1 },
      { type: 'npm', command: 'npm i -g @openai/codex', priority: 2 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g @openai/codex', priority: 1 },
      { type: 'npm', command: 'npm i -g @openai/codex', priority: 2 },
      { type: 'binary', command: 'brew install codex', priority: 3 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g @openai/codex', priority: 1 },
      { type: 'npm', command: 'npm i -g @openai/codex', priority: 2 },
      { type: 'binary', command: 'brew install codex', priority: 3 },
    ],
  },
}
