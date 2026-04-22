import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { BUILD_PACKAGE_NAME } from '../../generated/build-meta'
import * as npmPm from '../../package-manager/npm'

export const npmSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'npm',
  canHandle: inspection => inspection.installSource === 'npm',
  getManualUpgradeCommand: () => `npm install -g ${BUILD_PACKAGE_NAME}@latest`,
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    return {
      installSource: inspection.installSource,
      success: await npmPm.update(BUILD_PACKAGE_NAME),
    }
  },
}
