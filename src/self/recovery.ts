import type { SelfInspection, SelfInstallSource, SelfUpdateChannel, SelfUpdateResult } from './types'
import { getSelfUpgradeProvider, getSelfUpgradeProviderForInstallSource } from './providers'

export function getSelfUpgradeRecoveryHint(
  installSource: SelfInstallSource,
  executablePath: string,
  updateChannel: SelfUpdateChannel = 'stable',
  result?: SelfUpdateResult,
): string | undefined {
  if (result?.error?.kind === 'locked') return 'another qtx upgrade is already running; wait for it to finish and retry'

  const provider = getSelfUpgradeProviderForInstallSource(installSource, executablePath, updateChannel)
  return provider.getRecoveryHint(
    {
      canAutoUpdate: installSource === 'binary' || installSource === 'bun' || installSource === 'npm',
      currentVersion: '',
      executablePath,
      installSource,
      packageRoot: '',
      updateChannel,
    },
    result,
  )
}

export function getSelfUpgradeRecoveryHintForInspection(
  inspection: SelfInspection,
  result?: SelfUpdateResult,
): string | undefined {
  if (result?.error?.kind === 'locked') return 'another qtx upgrade is already running; wait for it to finish and retry'

  return getSelfUpgradeProvider(inspection).getRecoveryHint(inspection, result)
}
