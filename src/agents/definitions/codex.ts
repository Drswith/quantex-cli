import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall } from '../methods'

export const codex: AgentDefinition = {
  name: 'codex',
  displayName: 'Codex CLI',
  homepage: 'https://developers.openai.com/codex/cli',
  packages: {
    npm: '@openai/codex',
  },
  binaryName: 'codex',
  selfUpdate: {
    command: ['codex', '--upgrade'],
  },
  platforms: {
    windows: [
      bunInstall(),
      npmInstall(),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
      brewInstall('codex'),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
      brewInstall('codex'),
    ],
  },
}
