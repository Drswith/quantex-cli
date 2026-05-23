import type { AgentDefinition } from '../src/agents'
import { installAgent, uninstallAgent, updateAgent } from '../src/package-manager'
import { getInstalledAgentState } from '../src/state'

const PACKAGE_NAME = 'jsr:@scope/deno-smoke-agent'
const BINARY_NAME = 'deno-smoke-agent'
const INSTALL_ARGS = ['--allow-net', '--name', BINARY_NAME]

const agent: AgentDefinition = {
  binaryName: BINARY_NAME,
  displayName: 'Deno Smoke Agent',
  homepage: 'https://example.com/deno-smoke-agent',
  name: BINARY_NAME,
  packages: {
    deno: PACKAGE_NAME,
  },
  platforms: {
    linux: [{ packageInstallArgs: INSTALL_ARGS, type: 'deno' }],
    macos: [{ packageInstallArgs: INSTALL_ARGS, type: 'deno' }],
    windows: [{ packageInstallArgs: INSTALL_ARGS, type: 'deno' }],
  },
}

const install = await installAgent(agent)
if (!install.success || install.installedState?.installType !== 'deno') {
  throw new Error('deno smoke install should persist deno install state')
}

const installedState = await getInstalledAgentState(agent.name)
if (installedState?.installType !== 'deno' || installedState.packageName !== PACKAGE_NAME) {
  throw new Error('deno smoke install state should record the Deno package specifier')
}
if (installedState.binaryName !== BINARY_NAME) {
  throw new Error('deno smoke install state should record the executable name')
}
if (installedState.packageInstallArgs?.join(' ') !== INSTALL_ARGS.join(' ')) {
  throw new Error('deno smoke install state should record package install args')
}

const update = await updateAgent(agent, installedState)
if (!update.success) throw new Error('deno smoke update should succeed')

const uninstall = await uninstallAgent(agent)
if (!uninstall) throw new Error('deno smoke uninstall should succeed')

const removedState = await getInstalledAgentState(agent.name)
if (removedState) throw new Error('deno smoke uninstall should remove installed-agent state')
