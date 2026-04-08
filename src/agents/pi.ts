import type { AgentDefinition } from './types'
import { bunInstall, npmInstall } from './methods'

export const pi: AgentDefinition = {
  name: 'pi',
  aliases: ['pi'],
  displayName: 'Pi',
  description: '极简可扩展的终端编程 Agent',
  homepage: 'https://pi.dev',
  packages: {
    npm: '@mariozechner/pi-coding-agent',
  },
  binaryName: 'pi',
  platforms: {
    windows: [
      bunInstall(1),
      npmInstall(2),
    ],
    macos: [
      bunInstall(1),
      npmInstall(2),
    ],
    linux: [
      bunInstall(1),
      npmInstall(2),
    ],
  },
}
