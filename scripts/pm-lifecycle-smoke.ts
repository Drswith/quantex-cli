import type { AgentDefinition } from '../src/agents'
import { getAgentByNameOrAlias } from '../src/agents'
import { getManagedInstalledPackageVersion, installAgent, uninstallAgent, updateAgent } from '../src/package-manager'
import { getInstalledAgentState } from '../src/state'
import { getPlatform } from '../src/utils/detect'
import { getInstalledVersion } from '../src/utils/version'

type PackageManager = 'cargo' | 'deno' | 'uv'

const manager = process.argv[2] as PackageManager | undefined
if (manager !== 'cargo' && manager !== 'deno' && manager !== 'uv') {
  throw new Error(`Usage: bun run scripts/pm-lifecycle-smoke.ts <cargo|deno|uv>`)
}

const DENO_PACKAGE_NAME = 'jsr:@scope/deno-smoke-agent'
const DENO_BINARY_NAME = 'deno-smoke-agent'
const DENO_INSTALL_ARGS = ['--allow-net', '--name', DENO_BINARY_NAME]

const UV_PACKAGE_NAME = 'uv-smoke-agent'
const UV_INSTALL_ARGS = ['--python', '3.12']

const fakeAgents: Record<PackageManager, AgentDefinition> = {
  cargo: {
    binaryName: 'cargo-smoke-agent',
    displayName: 'Cargo Smoke Agent',
    homepage: 'https://example.com/cargo-smoke-agent',
    name: 'cargo-smoke-agent',
    packages: {
      cargo: 'cargo-smoke-agent',
    },
    platforms: {
      linux: [{ type: 'cargo' }],
      macos: [{ type: 'cargo' }],
      windows: [{ type: 'cargo' }],
    },
  },
  deno: {
    binaryName: DENO_BINARY_NAME,
    displayName: 'Deno Smoke Agent',
    homepage: 'https://example.com/deno-smoke-agent',
    name: DENO_BINARY_NAME,
    packages: {
      deno: DENO_PACKAGE_NAME,
    },
    platforms: {
      linux: [{ packageInstallArgs: DENO_INSTALL_ARGS, type: 'deno' }],
      macos: [{ packageInstallArgs: DENO_INSTALL_ARGS, type: 'deno' }],
      windows: [{ packageInstallArgs: DENO_INSTALL_ARGS, type: 'deno' }],
    },
  },
  uv: {
    binaryName: UV_PACKAGE_NAME,
    displayName: 'Uv Smoke Agent',
    homepage: 'https://example.com/uv-smoke-agent',
    name: UV_PACKAGE_NAME,
    packages: {
      uv: UV_PACKAGE_NAME,
    },
    platforms: {
      linux: [{ packageInstallArgs: UV_INSTALL_ARGS, type: 'uv' }],
      macos: [{ packageInstallArgs: UV_INSTALL_ARGS, type: 'uv' }],
      windows: [{ packageInstallArgs: UV_INSTALL_ARGS, type: 'uv' }],
    },
  },
}

const requestedCargoAgent = manager === 'cargo' ? process.env.QTX_CARGO_SMOKE_AGENT : undefined
const agent = requestedCargoAgent ? getCargoOnlyCatalogAgent(requestedCargoAgent) : fakeAgents[manager]

function getCargoOnlyCatalogAgent(name: string): AgentDefinition {
  const catalogAgent = getAgentByNameOrAlias(name)
  if (!catalogAgent) throw new Error(`Unknown cargo smoke agent: ${name}`)

  const platform = getPlatform()
  const cargoMethod = catalogAgent.platforms[platform]?.find(method => method.type === 'cargo')
  if (!cargoMethod) throw new Error(`${catalogAgent.name} does not expose a Cargo install method on ${platform}`)

  return {
    ...catalogAgent,
    platforms: {
      [platform]: [cargoMethod],
    },
  }
}

const install = await installAgent(agent)
if (!install.success || install.installedState?.installType !== manager) {
  throw new Error(`${manager} smoke install should persist ${manager} install state`)
}

const installedState = await getInstalledAgentState(agent.name)
if (installedState?.installType !== manager || installedState.packageName !== agent.packages?.[manager]) {
  throw new Error(`${manager} smoke install state should record the package name`)
}

if (manager === 'deno') {
  if (installedState.binaryName !== DENO_BINARY_NAME) {
    throw new Error('deno smoke install state should record the executable name')
  }
  if (installedState.packageInstallArgs?.join(' ') !== DENO_INSTALL_ARGS.join(' ')) {
    throw new Error('deno smoke install state should record package install args')
  }
}

if (manager === 'uv') {
  if (installedState.packageInstallArgs?.join(' ') !== UV_INSTALL_ARGS.join(' ')) {
    throw new Error('uv smoke install state should record package install args')
  }

  const managedVersion = await getManagedInstalledPackageVersion('uv', UV_PACKAGE_NAME)
  if (managedVersion !== '1.2.3') {
    throw new Error(`uv smoke should inspect installed tool version 1.2.3, received ${managedVersion ?? '(missing)'}`)
  }
}

if (manager === 'cargo' && requestedCargoAgent) {
  const installedVersion = await getInstalledVersion(agent.binaryName, agent.versionProbe)
  if (!installedVersion) {
    throw new Error(`${agent.name} should expose a version after Cargo install`)
  }
}

const update = await updateAgent(agent, installedState)
if (!update.success) throw new Error(`${manager} smoke update should succeed`)

const uninstall = await uninstallAgent(agent)
if (!uninstall) throw new Error(`${manager} smoke uninstall should succeed`)

if (manager !== 'cargo') {
  const removedState = await getInstalledAgentState(agent.name)
  if (removedState) throw new Error(`${manager} smoke uninstall should remove installed-agent state`)
}
