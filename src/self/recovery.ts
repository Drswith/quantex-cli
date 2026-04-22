import type { SelfInspection, SelfInstallSource, SelfUpdateResult } from './types'
import { BUILD_PACKAGE_NAME } from '../generated/build-meta'
import { getBinaryReleaseDownloadUrl } from './release'

export function getSelfUpgradeRecoveryHint(
  installSource: SelfInstallSource,
  executablePath: string,
  result?: SelfUpdateResult,
): string | undefined {
  if (result?.error?.kind === 'locked')
    return 'another qtx upgrade is already running; wait for it to finish and retry'

  if (installSource === 'bun')
    return `bun add -g ${BUILD_PACKAGE_NAME}@latest`

  if (installSource === 'npm')
    return `npm install -g ${BUILD_PACKAGE_NAME}@latest`

  if (installSource === 'binary') {
    const downloadUrl = getBinaryReleaseDownloadUrl(executablePath)
    if (!downloadUrl)
      return undefined

    if (result?.error?.kind === 'permission')
      return `check write permission for the current binary path, or download and replace the binary from ${downloadUrl}`

    if (result?.error?.kind === 'network')
      return `check network access and retry, or download and replace the binary from ${downloadUrl}`

    return `download and replace the binary from ${downloadUrl}`
  }

  return undefined
}

export function getSelfUpgradeRecoveryHintForInspection(
  inspection: SelfInspection,
  result?: SelfUpdateResult,
): string | undefined {
  return getSelfUpgradeRecoveryHint(inspection.installSource, inspection.executablePath, result)
}
