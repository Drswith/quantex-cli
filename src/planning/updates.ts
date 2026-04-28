import type { AgentInspection } from '../inspection'
import type { ManagedInstallType } from '../package-manager'
import { resolveAgentUpdateProvider } from '../agent-update'
import { canAutoUpdateAgent } from '../utils/install'

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
  const grouped: Record<ManagedInstallType, UpdatePlanEntry[]> = {
    bun: [],
    npm: [],
    brew: [],
    winget: [],
  }
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

    if (shouldSkipUnknownManualUpdate(inspection)) {
      skippedManualCheck.push(inspection)
      continue
    }

    if (!isInspectionUpdateAvailable(inspection)) {
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
    entries: [...grouped.bun, ...grouped.npm, ...grouped.brew, ...grouped.winget, ...manual],
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
  if (inspection.installedVersion && inspection.latestVersion)
    return inspection.installedVersion !== inspection.latestVersion

  return true
}

function shouldSkipUnknownManualUpdate(
  inspection: Pick<AgentInspection, 'agent' | 'installedState' | 'latestVersion'>,
): boolean {
  return !inspection.latestVersion && !canAutoUpdateAgent(inspection.agent, inspection.installedState)
}
