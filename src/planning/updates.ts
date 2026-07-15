import type { AgentInspection } from '../inspection'
import type { ManagedInstallType } from '../package-manager'
import { resolveAgentUpdateProvider } from '../agent-update'
import { planLifecycleUpdate } from '../lifecycle/update-planner'
import { getManagedInstallTypes } from '../package-manager/capabilities'

export interface UpdatePlanEntry {
  inspection: AgentInspection
  installerType?: ManagedInstallType
  strategy: 'grouped' | 'manual' | 'self-update'
}

export interface UpdatePlan {
  entries: UpdatePlanEntry[]
  grouped: Record<ManagedInstallType, UpdatePlanEntry[]>
  manual: UpdatePlanEntry[]
  skippedManualCheck: AgentInspection[]
  untrackedInPath: AgentInspection[]
  upToDate: AgentInspection[]
}

export function createUpdatePlan(
  inspections: AgentInspection[],
  options: {
    skipUntrackedInPath?: boolean
  } = {},
): UpdatePlan {
  const managedInstallTypes = getManagedInstallTypes()
  const grouped = managedInstallTypes.reduce(
    (groups, type) => {
      groups[type] = []
      return groups
    },
    {} as Record<ManagedInstallType, UpdatePlanEntry[]>,
  )
  const manual: UpdatePlanEntry[] = []
  const skippedManualCheck: AgentInspection[] = []
  const untrackedInPath: AgentInspection[] = []
  const upToDate: AgentInspection[] = []

  for (const inspection of inspections) {
    if (!inspection.inPath) continue

    if (options.skipUntrackedInPath && !inspection.installedState) {
      untrackedInPath.push(inspection)
      continue
    }

    const decision = getInspectionUpdateDecision(inspection)
    if (decision === 'indeterminate' || decision === 'manual-required' || decision === 'blocked-source') {
      skippedManualCheck.push(inspection)
      continue
    }

    if (decision !== 'upgrade') {
      upToDate.push(inspection)
      continue
    }

    const strategy = resolveAgentUpdateProvider({
      agent: inspection.agent,
      installedState: inspection.installedState,
      methods: inspection.methods,
    })

    const installerType =
      strategy.strategy === 'managed'
        ? strategy.getManagedInstallerType?.({
            agent: inspection.agent,
            installedState: inspection.installedState,
            methods: inspection.methods,
          })
        : undefined
    if (installerType) {
      const entry: UpdatePlanEntry = {
        inspection,
        installerType,
        strategy: 'grouped',
      }
      grouped[installerType].push(entry)
      continue
    }

    manual.push({
      inspection,
      strategy: strategy.strategy === 'self-update' ? 'self-update' : 'manual',
    })
  }

  return {
    entries: [...managedInstallTypes.flatMap(type => grouped[type]), ...manual],
    grouped,
    manual,
    skippedManualCheck,
    untrackedInPath,
    upToDate,
  }
}

export function isInspectionUpdateAvailable(
  inspection: Pick<AgentInspection, 'installedVersion' | 'latestVersion'>,
): boolean {
  return getInspectionUpdateDecision(inspection) === 'upgrade'
}

function getInspectionUpdateDecision(inspection: Pick<AgentInspection, 'installedVersion' | 'latestVersion'>) {
  return planLifecycleUpdate({
    intent: {
      kind: 'update',
      targetId: 'compatibility-update',
      targetVersion: inspection.latestVersion,
    },
    observation: {
      drift: { kind: 'none' },
      kind: 'present',
      providerId: 'compatibility',
      providerTargetId: 'compatibility-update',
      providerTargetKind: 'package',
      targetId: 'compatibility-update',
      version: inspection.installedVersion,
    },
    provider: {
      capabilities: ['observe', 'update', 'verify'],
      providerId: 'compatibility',
      targetId: 'compatibility-update',
      targetKind: 'package',
    },
  }).decision
}
