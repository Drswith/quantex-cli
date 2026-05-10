import type { AgentDefinition } from '../src/agents'
import { getAgentByNameOrAlias } from '../src/agents'
import { installAgent, uninstallAgent, updateAgent } from '../src/package-manager'
import { getInstalledAgentState } from '../src/state'
import { getPlatform } from '../src/utils/detect'
import { getInstalledVersion } from '../src/utils/version'

const requestedAgent = process.env.QTX_CARGO_SMOKE_AGENT
const agent = requestedAgent ? getCargoOnlyCatalogAgent(requestedAgent) : getFakeCargoAgent()

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

function getFakeCargoAgent(): AgentDefinition {
  return {
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
  }
}

const install = await installAgent(agent)
if (!install.success || install.installedState?.installType !== 'cargo') {
  throw new Error('cargo smoke install should persist cargo install state')
}

const installedState = await getInstalledAgentState(agent.name)
if (installedState?.installType !== 'cargo' || installedState.packageName !== agent.packages?.cargo) {
  throw new Error('cargo smoke install state should record the crate name')
}

const installedVersion = await getInstalledVersion(agent.binaryName, agent.versionProbe)
if (requestedAgent && !installedVersion) {
  throw new Error(`${agent.name} should expose a version after Cargo install`)
}

const update = await updateAgent(agent, installedState)
if (!update.success) throw new Error('cargo smoke update should succeed')

const uninstall = await uninstallAgent(agent)
if (!uninstall) throw new Error('cargo smoke uninstall should succeed')
