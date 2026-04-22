import type { SelfInspection, SelfInstallSource, SelfUpdateResult } from '../types'

export interface SelfUpgradeProvider {
  canHandle: (inspection: SelfInspection) => boolean
  getManualUpgradeCommand: (inspection: SelfInspection) => string | undefined
  upgrade: (inspection: SelfInspection) => Promise<SelfUpdateResult>
  source: SelfInstallSource
}
