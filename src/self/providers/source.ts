import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'

export const sourceSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'source',
  canHandle: inspection => inspection.installSource === 'source' || inspection.installSource === 'unknown',
  getRecoveryHint: () => undefined,
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    return {
      error: {
        kind: 'unsupported',
        message: `Install source "${inspection.installSource}" does not support auto-update.`,
      },
      installSource: inspection.installSource,
      success: false,
    }
  },
}
