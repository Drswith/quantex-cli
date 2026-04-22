import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { upgradeStandaloneBinary } from '../binary'
import { fetchBinaryReleaseChecksum, getBinaryReleaseAssetName, getBinaryReleaseDownloadUrl } from '../release'

export const binarySelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'binary',
  canHandle: inspection => inspection.installSource === 'binary',
  getRecoveryHint: (inspection, result) => {
    const downloadUrl = getBinaryReleaseDownloadUrl(inspection.executablePath)
    if (!downloadUrl)
      return undefined

    if (result?.error?.kind === 'locked')
      return `close other qtx processes and retry, or download and replace the binary from ${downloadUrl}`

    if (result?.error?.kind === 'permission')
      return `check write permission for the current binary path, or download and replace the binary from ${downloadUrl}`

    if (result?.error?.kind === 'network')
      return `check network access and retry, or download and replace the binary from ${downloadUrl}`

    return `download and replace the binary from ${downloadUrl}`
  },
  async upgrade(inspection: SelfInspection): Promise<SelfUpdateResult> {
    const assetName = getBinaryReleaseAssetName(inspection.executablePath)
    const downloadUrl = getBinaryReleaseDownloadUrl(inspection.executablePath)

    if (!assetName || !downloadUrl) {
      return {
        error: {
          kind: 'unsupported',
          message: 'No release artifact is available for the current platform and architecture.',
        },
        installSource: inspection.installSource,
        success: false,
      }
    }

    let checksum: string

    try {
      checksum = await fetchBinaryReleaseChecksum(assetName)
    }
    catch (error) {
      return {
        error: {
          detail: error,
          kind: 'checksum',
          message: `Failed to resolve the release checksum for ${assetName}.`,
        },
        installSource: inspection.installSource,
        success: false,
      }
    }

    const result = await upgradeStandaloneBinary(downloadUrl, inspection.executablePath, checksum)

    return { ...result, installSource: inspection.installSource }
  },
}
