import type { AgentDefinition } from '../src/agents'
import { getManagedInstalledPackageVersion, installAgent, uninstallAgent, updateAgent } from '../src/package-manager'
import { getInstalledAgentState } from '../src/state'

const PACKAGE_NAME = 'uv-smoke-agent'
const INSTALL_ARGS = ['--python', '3.12']

const agent: AgentDefinition = {
  binaryName: PACKAGE_NAME,
  displayName: 'Uv Smoke Agent',
  homepage: 'https://example.com/uv-smoke-agent',
  name: PACKAGE_NAME,
  packages: {
    uv: PACKAGE_NAME,
  },
  platforms: {
    linux: [{ packageInstallArgs: INSTALL_ARGS, type: 'uv' }],
    macos: [{ packageInstallArgs: INSTALL_ARGS, type: 'uv' }],
    windows: [{ packageInstallArgs: INSTALL_ARGS, type: 'uv' }],
  },
}

const install = await installAgent(agent)
if (!install.success || install.installedState?.installType !== 'uv') {
  throw new Error('uv smoke install should persist uv install state')
}

const installedState = await getInstalledAgentState(agent.name)
if (installedState?.installType !== 'uv' || installedState.packageName !== PACKAGE_NAME) {
  throw new Error('uv smoke install state should record the uv tool package name')
}
if (installedState.packageInstallArgs?.join(' ') !== INSTALL_ARGS.join(' ')) {
  throw new Error('uv smoke install state should record package install args')
}

const managedVersion = await getManagedInstalledPackageVersion('uv', PACKAGE_NAME)
if (managedVersion !== '1.2.3') {
  throw new Error(`uv smoke should inspect installed tool version 1.2.3, received ${managedVersion ?? '(missing)'}`)
}

const update = await updateAgent(agent, installedState)
if (!update.success) throw new Error('uv smoke update should succeed')

const uninstall = await uninstallAgent(agent)
if (!uninstall) throw new Error('uv smoke uninstall should succeed')

const removedState = await getInstalledAgentState(agent.name)
if (removedState) throw new Error('uv smoke uninstall should remove installed-agent state')
