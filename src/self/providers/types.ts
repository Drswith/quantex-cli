import type { SelfInspection, SelfInstallSource, SelfUpdateResult } from '../types'

export interface SelfUpgradeProvider {
  canHandle: (inspection: SelfInspection) => boolean
  getRecoveryHint: (inspection: SelfInspection, result?: SelfUpdateResult) => string | undefined
  upgrade: (inspection: SelfInspection) => Promise<SelfUpdateResult>
  source: SelfInstallSource
}
