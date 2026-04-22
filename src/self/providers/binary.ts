import type { SelfInspection, SelfUpdateResult } from '../types'
import type { SelfUpgradeProvider } from './types'
import { upgradeStandaloneBinary } from '../binary'
import { fetchBinaryReleaseManifest, getBinaryReleaseAssetName, getBinaryReleaseDownloadUrl, resolveBinaryReleaseAsset } from '../release'

export const binarySelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'binary',
  canHandle: inspection => inspection.installSource === 'binary',
  getRecoveryHint: (inspection, result) => {
    const downloadUrl = result?.error?.detail && typeof result.error.detail === 'object' && 'downloadUrl' in (result.error.detail as Record<string, unknown>)
      ? String((result.error.detail as Record<string, unknown>).downloadUrl)
      : getBinaryReleaseDownloadUrl(inspection.executablePath)

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

    if (!assetName) {
      return {
        error: {
          kind: 'unsupported',
          message: 'No release artifact is available for the current platform and architecture.',
        },
        installSource: inspection.installSource,
        success: false,
      }
    }

    let manifest
    try {
      manifest = await fetchBinaryReleaseManifest(inspection.updateChannel)
    }
    catch (error) {
      return {
        error: {
          detail: error,
          kind: 'network',
          message: `Failed to resolve the ${inspection.updateChannel} release manifest.`,
        },
        installSource: inspection.installSource,
        success: false,
      }
    }

    const asset = resolveBinaryReleaseAsset(manifest, inspection.executablePath)

    if (!asset) {
      return {
        error: {
          detail: {
            channel: inspection.updateChannel,
          },
          kind: 'unsupported',
          message: `No binary asset is available for the current platform on the ${inspection.updateChannel} channel.`,
        },
        installSource: inspection.installSource,
        success: false,
      }
    }

    const result = await upgradeStandaloneBinary(
      asset.downloadUrl,
      inspection.executablePath,
      asset.checksum,
      manifest.version,
    )

    const enrichedResult = !result.success && result.error
      ? {
          ...result,
          error: {
            ...result.error,
            detail: {
              ...(typeof result.error.detail === 'object' && result.error.detail ? result.error.detail as Record<string, unknown> : {}),
              downloadUrl: asset.downloadUrl,
            },
          },
        }
      : result

    return {
      ...enrichedResult,
      installSource: inspection.installSource,
      newVersion: result.success ? manifest.version : undefined,
    }
  },
}
