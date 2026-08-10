import type { AgentDefinition, InstallMethod } from '../agents/types'
import type { InstalledAgentState } from '../state'
import { getManagedInstalledPackageVersion, getOrderedInstallMethods } from '../package-manager'
import { getInstalledAgentState } from '../state'
import { resolveAgentExecutablePath } from '../utils/executable-resolution'
import {
  formatInstalledSource,
  formatUpdateManagement,
  getInstallLifecycle,
  getLatestVersionPackage,
  isManagedInstallType,
} from '../utils/install'
import { getLatestVersion, getResolvedBinaryPath, probeInstalledVersion } from '../utils/version'

export interface AgentInspection {
  agent: AgentDefinition
  methods: InstallMethod[]
  installedState?: InstalledAgentState
  inPath: boolean
  installedVersion?: string
  latestVersion?: string
  binaryPath?: string
  resolvedBinaryPath?: string
  sourceLabel: string
  updateLabel: string
  lifecycle: 'managed' | 'unmanaged'
}

export async function inspectAgent(agent: AgentDefinition): Promise<AgentInspection> {
  // One resolution feeds presence, the reported path, and the version probe, so
  // an agent outside the inherited PATH stays consistent across all three.
  const [methods, installedState, binaryPath] = await Promise.all([
    getOrderedInstallMethods(agent),
    getInstalledAgentState(agent.name),
    resolveAgentExecutablePath(agent.binaryName),
  ])
  const inPath = binaryPath !== undefined

  const [installedVersion, latestVersion] = await Promise.all([
    inPath ? getAgentInstalledVersion(agent, installedState, binaryPath) : Promise.resolve(undefined),
    getLatestVersionForAgent(agent, installedState, methods),
  ])
  const resolvedBinaryPath = await getResolvedBinaryPath(binaryPath)

  return {
    agent,
    methods,
    installedState,
    inPath,
    installedVersion,
    latestVersion,
    binaryPath,
    resolvedBinaryPath,
    sourceLabel: formatInstalledSource(installedState),
    updateLabel: formatUpdateManagement(agent, installedState),
    lifecycle: installedState ? getInstallLifecycle(installedState.installType) : 'unmanaged',
  }
}

export async function inspectAllAgents(agents: AgentDefinition[]): Promise<AgentInspection[]> {
  return Promise.all(agents.map(inspectAgent))
}

async function getAgentInstalledVersion(
  agent: AgentDefinition,
  installedState: InstalledAgentState | undefined,
  executablePath?: string,
): Promise<string | undefined> {
  if (installedState && isManagedInstallType(installedState.installType) && installedState.packageName) {
    const managedPackageVersion = await getManagedInstalledPackageVersion(
      installedState.installType,
      installedState.packageName,
      installedState.packageTargetKind,
    )

    if (managedPackageVersion) return managedPackageVersion
  }

  return probeInstalledVersion(agent.binaryName, agent.versionProbe, undefined, executablePath)
}

async function getLatestVersionForAgent(
  agent: AgentDefinition,
  installedState: InstalledAgentState | undefined,
  methods: InstallMethod[],
): Promise<string | undefined> {
  const packageName = getLatestVersionPackage(agent, installedState, methods)
  if (!packageName) return undefined

  return getLatestVersion(packageName)
}
