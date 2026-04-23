import type { AgentDefinition } from '../types'
import { bunInstall, npmInstall } from '../methods'

export const pi: AgentDefinition = {
  name: 'pi',
  displayName: 'Pi',
  description: '极简可扩展的终端编程 Agent',
  homepage: 'https://pi.dev',
  packages: {
    npm: '@mariozechner/pi-coding-agent',
  },
  binaryName: 'pi',
  selfUpdate: {
    command: ['pi', 'update'],
  },
  platforms: {
    windows: [
      bunInstall(),
      npmInstall(),
    ],
    macos: [
      bunInstall(),
      npmInstall(),
    ],
    linux: [
      bunInstall(),
      npmInstall(),
    ],
  },
}
