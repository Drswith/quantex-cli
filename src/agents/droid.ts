import type { AgentDefinition } from './types'

export const droid: AgentDefinition = {
  name: 'droid',
  aliases: ['droid'],
  displayName: 'Droid',
  description: 'Factory AI 软件工程 Agent CLI',
  homepage: 'https://docs.factory.ai/cli/getting-started/overview',
  package: 'droid',
  binaryName: 'droid',
  platforms: {
    windows: [
      { type: 'bun', command: 'bun add -g droid', priority: 1 },
      { type: 'npm', command: 'npm i -g droid', priority: 2 },
      { type: 'binary', command: 'irm https://app.factory.ai/cli/windows | iex', priority: 3 },
    ],
    macos: [
      { type: 'bun', command: 'bun add -g droid', priority: 1 },
      { type: 'npm', command: 'npm i -g droid', priority: 2 },
      { type: 'binary', command: 'curl -fsSL https://app.factory.ai/cli | sh', priority: 3 },
      { type: 'binary', command: 'brew install --cask droid', priority: 4 },
    ],
    linux: [
      { type: 'bun', command: 'bun add -g droid', priority: 1 },
      { type: 'npm', command: 'npm i -g droid', priority: 2 },
      { type: 'binary', command: 'curl -fsSL https://app.factory.ai/cli | sh', priority: 3 },
      { type: 'binary', command: 'brew install --cask droid', priority: 4 },
    ],
  },
}
