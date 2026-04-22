import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { upgradeStandaloneBinary } from '../binary'
import { getBinaryReleaseDownloadUrl } from '../release'

export const binarySelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'binary',
  canHandle: inspection => inspection.installSource === 'binary',
  getManualUpgradeCommand: (inspection) => {
    const downloadUrl = getBinaryReleaseDownloadUrl(inspection.executablePath)
    return downloadUrl ? `download and replace the binary from ${downloadUrl}` : undefined
  },
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    const downloadUrl = getBinaryReleaseDownloadUrl(inspection.executablePath)

    return {
      installSource: inspection.installSource,
      success: downloadUrl
        ? await upgradeStandaloneBinary(downloadUrl, inspection.executablePath)
        : false,
    }
  },
}
