import type { AgentDefinition } from '../types'
import { binaryInstall, pipInstall, scriptInstall } from '../methods'

export const vibe: AgentDefinition = {
  name: 'vibe',
  lookupAliases: ['mistral-vibe'],
  displayName: 'Mistral Vibe',
  homepage: 'https://docs.mistral.ai/mistral-vibe/terminal/install',
  binaryName: 'vibe',
  packages: {
    pip: 'mistral-vibe',
  },
  versionProbe: {
    command: ['vibe', '--version'],
  },
  platforms: {
    windows: [binaryInstall('uv tool install mistral-vibe'), pipInstall('mistral-vibe')],
    macos: [
      scriptInstall('curl -LsSf https://mistral.ai/vibe/install.sh | bash'),
      binaryInstall('uv tool install mistral-vibe'),
      pipInstall('mistral-vibe'),
    ],
    linux: [
      scriptInstall('curl -LsSf https://mistral.ai/vibe/install.sh | bash'),
      binaryInstall('uv tool install mistral-vibe'),
      pipInstall('mistral-vibe'),
    ],
  },
}
