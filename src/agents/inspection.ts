import type { ManagedInstallType } from '../package-manager'
import type { InstalledAgentState } from '../state'
import type { AgentDefinition, InstallMethod } from './types'
import { getOrderedInstallMethods } from '../package-manager'
import { getInstalledAgentState } from '../state'
import { isBinaryInPath } from '../utils/detect'
import { formatInstalledSource, formatUpdateManagement, getInstallLifecycle, getLatestVersionPackage, isManagedInstallType } from '../utils/install'
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

export interface AgentUpdateGroup {
  managed: Record<ManagedInstallType, AgentInspection[]>
  manual: AgentInspection[]
}

export async function inspectAgent(agent: AgentDefinition): Promise<AgentInspection> {
  const [methods, installedState, inPath] = await Promise.all([
    getOrderedInstallMethods(agent),
    getInstalledAgentState(agent.name),
    isBinaryInPath(agent.binaryName),
  ])

  const [installedVersion, binaryPath, latestVersion] = await Promise.all([
    inPath ? getInstalledVersion(agent.binaryName) : Promise.resolve(undefined),
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
    updateLabel: formatUpdateManagement(installedState),
    lifecycle: installedState ? getInstallLifecycle(installedState.installType) : 'unmanaged',
  }
}

export async function inspectAllAgents(agents: AgentDefinition[]): Promise<AgentInspection[]> {
  return Promise.all(agents.map(inspectAgent))
}

export function groupInspectionsForUpdate(inspections: AgentInspection[]): AgentUpdateGroup {
  const managed: Record<ManagedInstallType, AgentInspection[]> = {
    bun: [],
    npm: [],
    brew: [],
    winget: [],
  }
  const manual: AgentInspection[] = []

  for (const inspection of inspections) {
    const managedType = getManagedTrackedType(inspection.installedState)
    if (managedType) {
      managed[managedType].push(inspection)
      continue
    }

    manual.push(inspection)
  }

  return { managed, manual }
}

function getManagedTrackedType(state?: InstalledAgentState): ManagedInstallType | undefined {
  if (!state || !state.packageName || !isManagedInstallType(state.installType))
    return undefined

  return state.installType
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
