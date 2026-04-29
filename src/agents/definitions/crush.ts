import type { AgentDefinition } from '../types'
import { brewInstall, bunInstall, npmInstall, wingetInstall } from '../methods'

export const crush: AgentDefinition = {
  name: 'crush',
  displayName: 'Crush',
  homepage: 'https://github.com/charmbracelet/crush',
  packages: {
    npm: '@charmland/crush',
  },
  binaryName: 'crush',
  selfUpdate: {
    command: ['crush', 'update'],
  },
  versionProbe: {
    command: ['crush', '--version'],
  },
  platforms: {
    windows: [bunInstall(), npmInstall(), wingetInstall('charmbracelet.crush')],
    macos: [bunInstall(), npmInstall(), brewInstall('charmbracelet/tap/crush')],
    linux: [bunInstall(), npmInstall(), brewInstall('charmbracelet/tap/crush')],
  },
}
