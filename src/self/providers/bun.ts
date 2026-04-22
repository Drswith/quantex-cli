import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { BUILD_PACKAGE_NAME } from '../../generated/build-meta'
import * as bunPm from '../../package-manager/bun'

export const bunSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'bun',
  canHandle: inspection => inspection.installSource === 'bun',
  getManualUpgradeCommand: () => `bun add -g ${BUILD_PACKAGE_NAME}@latest`,
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    return {
      installSource: inspection.installSource,
      success: await bunPm.update(BUILD_PACKAGE_NAME),
    }
  },
}
