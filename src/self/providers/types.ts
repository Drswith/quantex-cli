import type { SelfInspection, SelfInstallSource, SelfUpdateResult, SelfUpgradePlan } from '../types'

export interface SelfUpgradeProvider {
  canHandle: (context: SelfInspection | SelfUpgradePlan) => boolean
  getRecoveryHint: (inspection: SelfInspection, result?: SelfUpdateResult) => string | undefined
  upgrade: (plan: SelfUpgradePlan) => Promise<SelfUpdateResult>
  source: SelfInstallSource
}
