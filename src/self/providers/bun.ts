import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { BUILD_PACKAGE_NAME } from '../../generated/build-meta'
import * as bunPm from '../../package-manager/bun'

export const bunSelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'bun',
  canHandle: inspection => inspection.installSource === 'bun',
  getRecoveryHint: inspection => `bun add -g ${BUILD_PACKAGE_NAME}@${inspection.updateChannel === 'beta' ? 'beta' : 'latest'}`,
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    const success = await bunPm.update(BUILD_PACKAGE_NAME, 'latest-major', inspection.updateChannel === 'beta' ? 'beta' : 'latest')
    return {
      error: success
        ? undefined
        : {
            kind: 'unknown',
            message: `Failed to update ${BUILD_PACKAGE_NAME} through Bun.`,
          },
      installSource: inspection.installSource,
      newVersion: success ? inspection.latestVersion : undefined,
      success,
    }
  },
}
