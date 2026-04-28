import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { BUILD_PACKAGE_NAME } from '../../generated/build-meta'
import * as npmPm from '../../package-manager/npm'

export const npmSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'npm',
  canHandle: inspection => inspection.installSource === 'npm',
  getRecoveryHint: inspection =>
    `npm install -g ${BUILD_PACKAGE_NAME}@${inspection.updateChannel === 'beta' ? 'beta' : 'latest'}`,
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    const success = await npmPm.install(
      BUILD_PACKAGE_NAME,
      inspection.updateChannel === 'beta' ? 'beta' : 'latest',
      inspection.managedRegistry,
    )
    return {
      error: success
        ? undefined
        : {
            kind: 'unknown',
            message: `Failed to update ${BUILD_PACKAGE_NAME} through npm.`,
          },
      installSource: inspection.installSource,
      newVersion: success ? inspection.latestVersion : undefined,
      success,
    }
  },
}
