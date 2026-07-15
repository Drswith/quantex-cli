import type { SelfInspection, SelfUpdateResult, SelfUpgradePlan } from '../types'
import type { SelfUpgradeProvider, SelfUpgradeProviderExecutionContext } from './types'
import { getWindowsStandaloneBinaryPeerPath, upgradeStandaloneBinary } from '../binary'
import { getBinaryReleaseDownloadUrl } from '../release'

export const binarySelfUpgradeProvider: SelfUpgradeProvider = {
  source: 'binary',
  canHandle: context => getInstallSource(context) === 'binary',
  getRecoveryHint: (inspection, result) => {
    const downloadUrl =
      result?.error?.detail &&
      typeof result.error.detail === 'object' &&
      'downloadUrl' in (result.error.detail as Record<string, unknown>)
        ? String((result.error.detail as Record<string, unknown>).downloadUrl)
        : getBinaryReleaseDownloadUrl(inspection.executablePath)

    if (!downloadUrl) return undefined

    if (result?.error?.kind === 'locked')
      return `close other qtx processes and retry, or download and replace the binary from ${downloadUrl}`

    if (result?.error?.kind === 'permission')
      return `check write permission for the current binary path, or download and replace the binary from ${downloadUrl}`

    if (result?.error?.kind === 'network')
      return `check network access and retry, or download and replace the binary from ${downloadUrl}`

    return `download and replace the binary from ${downloadUrl}`
  },
  async upgrade(plan: SelfUpgradePlan, context?: SelfUpgradeProviderExecutionContext): Promise<SelfUpdateResult> {
    const asset = plan.target.binaryAsset

    if (!asset) {
      return {
        error: plan.target.resolutionError ?? {
          kind: 'unsupported',
          message: 'No release artifact is available for the current platform and architecture.',
        },
        installSource: plan.facts.installSource,
        success: false,
      }
    }

    const peerPath = getWindowsStandaloneBinaryPeerPath(plan.facts.executablePath)
    const result = context
      ? await upgradeStandaloneBinary(
          asset.downloadUrl,
          plan.facts.executablePath,
          asset.checksum,
          plan.target.targetVersion ?? 'latest',
          peerPath,
          {
            networkPort: context.network,
            processPort: context.process,
            signal: context.signal,
            timeoutMs: context.timeoutMs,
          },
        )
      : await upgradeStandaloneBinary(
          asset.downloadUrl,
          plan.facts.executablePath,
          asset.checksum,
          plan.target.targetVersion ?? 'latest',
          peerPath,
        )

    const enrichedResult =
      !result.success && result.error
        ? {
            ...result,
            error: {
              ...result.error,
              detail: {
                ...(typeof result.error.detail === 'object' && result.error.detail
                  ? (result.error.detail as Record<string, unknown>)
                  : {}),
                downloadUrl: asset.downloadUrl,
              },
            },
          }
        : result

    return {
      ...enrichedResult,
      installSource: plan.facts.installSource,
      newVersion: result.success ? plan.target.targetVersion : undefined,
    }
  },
}

function getInstallSource(context: SelfInspection | SelfUpgradePlan): string {
  return 'facts' in context ? context.facts.installSource : context.installSource
}
