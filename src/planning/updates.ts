import type { AgentInspection } from '../inspection'
import type { ManagedInstallType } from '../package-manager'
import { isManagedInstallType } from '../package-manager/capabilities'
import { canUpdateInstalledState } from '../utils/install'

export interface UpdatePlanEntry {
  inspection: AgentInspection
  installerType?: ManagedInstallType
  strategy: 'grouped' | 'manual'
}

export interface UpdatePlan {
  entries: UpdatePlanEntry[]
  grouped: Record<ManagedInstallType, UpdatePlanEntry[]>
  manual: UpdatePlanEntry[]
  upToDate: AgentInspection[]
}

export function createUpdatePlan(inspections: AgentInspection[]): UpdatePlan {
  const grouped: Record<ManagedInstallType, UpdatePlanEntry[]> = {
    bun: [],
    npm: [],
    brew: [],
    winget: [],
  }
  const manual: UpdatePlanEntry[] = []
  const upToDate: AgentInspection[] = []

  for (const inspection of inspections) {
    if (!inspection.inPath)
      continue

    if (!isInspectionUpdateAvailable(inspection)) {
      upToDate.push(inspection)
      continue
    }

    const installerType = getGroupedInstallerType(inspection)
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
      strategy: 'manual',
    })
  }

  return {
    entries: [...grouped.bun, ...grouped.npm, ...grouped.brew, ...grouped.winget, ...manual],
    grouped,
    manual,
    upToDate,
  }
}

export function isInspectionUpdateAvailable(inspection: Pick<AgentInspection, 'installedVersion' | 'latestVersion'>): boolean {
  if (inspection.installedVersion && inspection.latestVersion)
    return inspection.installedVersion !== inspection.latestVersion

  return true
}

function getGroupedInstallerType(inspection: AgentInspection): ManagedInstallType | undefined {
  if (!inspection.installedState || !inspection.installedState.packageName)
    return undefined

  if (!canUpdateInstalledState(inspection.installedState))
    return undefined

  if (!isManagedInstallType(inspection.installedState.installType))
    return undefined

  return inspection.installedState.installType
}
