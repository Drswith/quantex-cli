import type { ProviderOperationContext } from '../providers'
import type { SelfInspection, SelfInstallSource, SelfUpdateChannel, SelfUpdateResult, SelfUpgradePlan } from './types'
import process from 'node:process'
import { resolveSelfInstallFactsReadOnly } from './facts'
import { acquireSelfUpgradeLock } from './lock'
import {
  buildPlanFromInspection,
  buildSelfInspectionFromPlan,
  planSelfUpgrade,
  verifySelfUpgradeResult,
} from './planning'
import { getSelfUpgradeProvider } from './providers'
import { getSelfUpgradeRecoveryHint } from './recovery'

export async function inspectSelf(options?: { updateChannel?: SelfUpdateChannel }): Promise<SelfInspection> {
  return buildSelfInspectionFromPlan(await planSelfUpgrade({ updateChannel: options?.updateChannel }))
}

export async function inspectSelfReadOnly(options?: {
  context?: ProviderOperationContext
  updateChannel?: SelfUpdateChannel
}): Promise<SelfInspection> {
  const facts = await resolveSelfInstallFactsReadOnly({ updateChannel: options?.updateChannel })
  return buildSelfInspectionFromPlan(await planSelfUpgrade({ context: options?.context, facts }))
}

export async function upgradeSelf(planOrInspection?: SelfInspection | SelfUpgradePlan): Promise<SelfUpdateResult> {
  const resolvedPlan = await coerceSelfUpgradePlan(planOrInspection)
  const releaseLock = await acquireSelfUpgradeLock()

  if (!releaseLock) {
    return {
      error: {
        kind: 'locked',
        message: 'Another qtx upgrade is already running.',
      },
      installSource: resolvedPlan.facts.installSource,
      success: false,
    }
  }

  try {
    const result = await getSelfUpgradeProvider(resolvedPlan).upgrade(resolvedPlan)
    return verifySelfUpgradeResult(resolvedPlan, result)
  } finally {
    await releaseLock()
  }
}

export function getManualSelfUpgradeCommand(
  installSource: SelfInstallSource,
  executablePath: string = process.execPath,
): string | undefined {
  return getSelfUpgradeRecoveryHint(installSource, executablePath)
}

async function coerceSelfUpgradePlan(planOrInspection?: SelfInspection | SelfUpgradePlan): Promise<SelfUpgradePlan> {
  if (!planOrInspection) return planSelfUpgrade()
  if ('facts' in planOrInspection) return planOrInspection
  if (planOrInspection.installSource === 'binary') {
    return planSelfUpgrade({
      facts: {
        canAutoUpdate: planOrInspection.canAutoUpdate,
        currentVersion: planOrInspection.currentVersion,
        executablePath: planOrInspection.executablePath,
        installSource: planOrInspection.installSource,
        packageRoot: planOrInspection.packageRoot,
        updateChannel: planOrInspection.updateChannel,
      },
    })
  }
  return buildPlanFromInspection(planOrInspection)
}

export { acquireSelfUpgradeLock, getSelfUpgradeLockPath } from './lock'
export {
  canAutoUpdateSelf,
  detectSelfInstallSource,
  getSelfVersion,
  reconcileSelfInstallSource,
  resolveSelfInstallFacts,
  resolveSelfInstallFactsReadOnly,
  resolveSelfInstallSource,
  resolveSelfPackageMetadata,
} from './facts'
export {
  buildPlanFromInspection,
  buildSelfInspectionFromPlan,
  isResolvedLatestBehindCurrent,
  planSelfUpgrade,
  resolveSelfUpdateTarget,
} from './planning'
export { resolveManagedSelfUpdateRegistry } from './registry'
export { getSelfUpgradeRecoveryHint, getSelfUpgradeRecoveryHintForInspection } from './recovery'
export {
  fetchBinaryReleaseChecksum,
  fetchBinaryReleaseManifest,
  fetchGitHubReleaseSummary,
  getBinaryReleaseAssetName,
  getBinaryReleaseChecksumUrl,
  getBinaryReleaseDownloadUrl,
  getSelfUpdateChannel,
  parseBinaryReleaseChecksum,
  resolveBinaryReleaseAsset,
  resolveBinaryReleaseManifestUrl,
} from './release'
export type {
  SelfInspection,
  SelfInstallFacts,
  SelfInstallSource,
  SelfPackageMetadata,
  SelfUpdateChannel,
  SelfUpdateResult,
  SelfUpdateTarget,
  SelfUpgradePlan,
  SelfUpgradePlanStatus,
} from './types'
