import type { AgentDefinition, InstallMethod } from '../agents/types'
import type { InstalledAgentState } from '../state'
import { getOrderedInstallMethods } from '../package-manager'
import { getInstalledAgentState } from '../state'
import { isBinaryInPath } from '../utils/detect'
import { formatInstalledSource, formatUpdateManagement, getInstallLifecycle, getLatestVersionPackage } from '../utils/install'
import { getBinaryPath, getInstalledVersion, getLatestVersion } from '../utils/version'

export interface AgentInspection {
  agent: AgentDefinition
  methods: InstallMethod[]
  installedState?: InstalledAgentState
  inPath: boolean
  installedVersion?: string
  latestVersion?: string
  binaryPath?: string
  sourceLabel: string
  updateLabel: string
  lifecycle: 'managed' | 'unmanaged'
}

export async function inspectAgent(agent: AgentDefinition): Promise<AgentInspection> {
  const [methods, installedState, inPath] = await Promise.all([
    getOrderedInstallMethods(agent),
    getInstalledAgentState(agent.name),
    isBinaryInPath(agent.binaryName),
  ])

  const [installedVersion, binaryPath, latestVersion] = await Promise.all([
    inPath ? getInstalledVersion(agent.binaryName, agent.versionProbe) : Promise.resolve(undefined),
    inPath ? getBinaryPath(agent.binaryName) : Promise.resolve(undefined),
    getLatestVersionForAgent(agent, installedState, methods),
  ])

  return {
    agent,
    methods,
    installedState,
    inPath,
    installedVersion,
    latestVersion,
    binaryPath,
    sourceLabel: formatInstalledSource(installedState),
    updateLabel: formatUpdateManagement(agent, installedState),
    lifecycle: installedState ? getInstallLifecycle(installedState.installType) : 'unmanaged',
  }
}

export async function inspectAllAgents(agents: AgentDefinition[]): Promise<AgentInspection[]> {
  return Promise.all(agents.map(inspectAgent))
}

async function getLatestVersionForAgent(
  agent: AgentDefinition,
  installedState: InstalledAgentState | undefined,
  methods: InstallMethod[],
): Promise<string | undefined> {
  const packageName = getLatestVersionPackage(agent, installedState, methods)
  if (!packageName)
    return undefined

  return getLatestVersion(packageName)
}
