import type { AgentDefinition } from '../agents'
import type { ManagedInstallType } from '../agents/types'
import type { AgentInspection } from '../inspection'
import type { ManagedPackageSpec } from '../package-manager'
import type { InstalledAgentState } from '../state'
import * as inspectionService from '../inspection'
import * as updatePlanning from '../planning'
import { inspectRegisteredAgents } from './agents'

export interface PendingAgentUpdate {
  agent: AgentDefinition
  inspection: AgentInspection
  state?: InstalledAgentState
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
  const inspections = await inspectRegisteredAgents()
  const plan = updatePlanning.createUpdatePlan(inspections)

  const grouped = groupedInstallerOrder
    .map(type => createManagedUpdateBucket(type, plan.grouped[type]))
    .filter((bucket): bucket is ManagedUpdateBucket => bucket !== undefined)

  return {
    entries: plan.entries.map(entry => toPendingAgentUpdate(entry.inspection)),
    grouped,
    manual: plan.manual.map(entry => toPendingAgentUpdate(entry.inspection)),
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
      if (!update.state?.packageName)
        return []

      return [{
        packageName: update.state.packageName,
        packageTargetKind: update.state.packageTargetKind,
      }]
    }),
    updates,
  }
}

function toPendingAgentUpdate(inspection: AgentInspection): PendingAgentUpdate {
  return {
    agent: inspection.agent,
    inspection,
    state: inspection.installedState,
  }
}
