import type { AgentUpdateStrategy } from '../agent-update'
import type { AgentDefinition } from '../agents'
import type { InstallMethod, ManagedInstallType } from '../agents/types'
import type { AgentInspection } from '../inspection'
import type { ManagedPackageSpec } from '../package-manager'
import type { InstalledAgentState } from '../state'
import { resolveAgentUpdateProvider } from '../agent-update'
import * as inspectionService from '../inspection'
import * as updatePlanning from '../planning'
import { getManagedPackageName } from '../utils/install'
import { inspectRegisteredAgents } from './agents'

export interface PendingAgentUpdate {
  agent: AgentDefinition
  inspection: AgentInspection
  installerType?: ManagedInstallType
  package?: ManagedPackageSpec
  state?: InstalledAgentState
  strategy: AgentUpdateStrategy
}

export interface ManagedUpdateBucket {
  type: ManagedInstallType
  packages: ManagedPackageSpec[]
  updates: PendingAgentUpdate[]
}

export interface PlannedAgentUpdates {
  entries: PendingAgentUpdate[]
  grouped: ManagedUpdateBucket[]
  manual: PendingAgentUpdate[]
  skippedManualCheck: AgentInspection[]
  upToDate: AgentInspection[]
}

export interface SingleAgentUpdateStatus {
  agent: AgentDefinition
  inspection: AgentInspection
  updateAvailable: boolean
}

const groupedInstallerOrder: ManagedInstallType[] = ['bun', 'npm', 'brew', 'winget']

export async function getSingleAgentUpdateStatus(agent: AgentDefinition): Promise<SingleAgentUpdateStatus> {
  const inspection = await inspectionService.inspectAgent(agent)
  return {
    agent,
    inspection,
    updateAvailable: updatePlanning.isInspectionUpdateAvailable(inspection),
  }
}

export async function planAgentUpdates(): Promise<PlannedAgentUpdates> {
  return buildPlannedAgentUpdates(await inspectRegisteredAgents())
}

export async function planSingleAgentUpdate(agent: AgentDefinition): Promise<{ inspection: AgentInspection, plan: PlannedAgentUpdates }> {
  const inspection = await inspectionService.inspectAgent(agent)
  return {
    inspection,
    plan: buildPlannedAgentUpdates([inspection]),
  }
}

function buildPlannedAgentUpdates(inspections: AgentInspection[]): PlannedAgentUpdates {
  const plan = updatePlanning.createUpdatePlan(inspections)
  const grouped = groupedInstallerOrder
    .map(type => createManagedUpdateBucket(type, plan.grouped[type]))
    .filter((bucket): bucket is ManagedUpdateBucket => bucket !== undefined)

  return {
    entries: plan.entries.map(entry => toPendingAgentUpdate(entry.inspection)),
    grouped,
    manual: plan.manual.map(entry => toPendingAgentUpdate(entry.inspection)),
    skippedManualCheck: plan.skippedManualCheck,
    upToDate: plan.upToDate,
  }
}

function createManagedUpdateBucket(
  type: ManagedInstallType,
  entries: Array<{ inspection: AgentInspection }>,
): ManagedUpdateBucket | undefined {
  if (entries.length === 0)
    return undefined

  const updates = entries.map(entry => toPendingAgentUpdate(entry.inspection))
  return {
    type,
    packages: updates.flatMap((update) => {
      if (!update.package?.packageName)
        return []

      return [update.package]
    }),
    updates,
  }
}

function toPendingAgentUpdate(inspection: AgentInspection): PendingAgentUpdate {
  const provider = resolveAgentUpdateProvider({
    agent: inspection.agent,
    installedState: inspection.installedState,
    methods: inspection.methods,
  })
  const installerType = provider.getManagedInstallerType?.({
    agent: inspection.agent,
    installedState: inspection.installedState,
    methods: inspection.methods,
  })

  return {
    agent: inspection.agent,
    inspection,
    installerType,
    package: installerType ? getManagedPackageSpec(inspection.agent, inspection.installedState, inspection.methods, installerType) : undefined,
    state: inspection.installedState,
    strategy: provider.strategy,
  }
}

function getManagedPackageSpec(
  agent: AgentDefinition,
  installedState: InstalledAgentState | undefined,
  methods: InstallMethod[],
  installerType: ManagedInstallType,
): ManagedPackageSpec | undefined {
  if (installedState?.packageName && installedState.installType === installerType) {
    return {
      packageName: installedState.packageName,
      packageTargetKind: installedState.packageTargetKind,
    }
  }

  const method = methods.find(candidate => candidate.type === installerType)
  if (!method)
    return undefined

  const packageName = getManagedPackageName(agent, method)
  if (!packageName)
    return undefined

  return {
    packageName,
    packageTargetKind: method.packageTargetKind,
  }
}
