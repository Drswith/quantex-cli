import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'

export const sourceSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'source',
  canHandle: inspection => inspection.installSource === 'source' || inspection.installSource === 'unknown',
  getManualUpgradeCommand: () => undefined,
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    return {
      installSource: inspection.installSource,
      success: false,
    }
  },
}
