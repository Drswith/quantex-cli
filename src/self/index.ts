import type { ProviderOperationContext } from '../providers'
import type { LockPort, NetworkPort, ProcessPort, ProcessStdio, RuntimeOutcome } from '../runtime'
import type { SelfInspection, SelfInstallSource, SelfUpdateChannel, SelfUpdateResult, SelfUpgradePlan } from './types'
import process from 'node:process'
import { ProcessInterruptionError } from '../utils/child-process'
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

export interface SelfUpgradeExecutionOptions {
  readonly lockPort?: LockPort
  readonly networkPort?: NetworkPort
  readonly processPort?: ProcessPort
  readonly signal?: AbortSignal
  readonly stdio?: readonly [ProcessStdio, ProcessStdio, ProcessStdio]
  readonly timeoutMs?: number
}

export async function upgradeSelf(
  planOrInspection?: SelfInspection | SelfUpgradePlan,
  options: SelfUpgradeExecutionOptions = {},
): Promise<SelfUpdateResult> {
  const resolvedPlan = await coerceSelfUpgradePlan(planOrInspection)
  const lease = options.lockPort
    ? await options.lockPort.acquire({
        resource: 'self upgrade',
        scope: ['self-upgrade'],
        signal: options.signal ?? new AbortController().signal,
        timeoutMs: options.timeoutMs,
      })
    : await acquireLegacySelfUpgradeLease()

  if (lease.kind === 'failure') {
    if (lease.error.kind === 'cancelled') throw new ProcessInterruptionError({ kind: 'cancelled' })
    if (lease.error.kind === 'timed-out')
      throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: options.timeoutMs ?? 0 })
    return {
      error: {
        kind: lease.error.kind === 'conflict' ? 'locked' : 'unknown',
        message: lease.error.message,
      },
      installSource: resolvedPlan.facts.installSource,
      success: false,
    }
  }

  let result: SelfUpdateResult
  try {
    const useRuntimePorts = options.networkPort !== undefined || options.processPort !== undefined
    const signal = options.signal ?? new AbortController().signal
    const providerResult = await getSelfUpgradeProvider(resolvedPlan).upgrade(
      resolvedPlan,
      useRuntimePorts
        ? {
            network: options.networkPort,
            process: options.processPort,
            signal,
            stdio: options.stdio,
            timeoutMs: options.timeoutMs,
          }
        : undefined,
    )
    result = await verifySelfUpgradeResult(
      resolvedPlan,
      providerResult,
      options.processPort ? { process: options.processPort, signal, timeoutMs: options.timeoutMs } : undefined,
    )
  } catch (error) {
    const release = await lease.value.release()
    if (release.kind === 'failure')
      throw new Error(`Self-upgrade failed and its lock could not be released: ${release.error.message}`, {
        cause: error,
      })
    throw error
  }

  const release = await lease.value.release()
  if (release.kind === 'failure') throw new Error(release.error.message)
  return result
}

async function acquireLegacySelfUpgradeLease(): Promise<RuntimeOutcome<{ release(): Promise<RuntimeOutcome<void>> }>> {
  const release = await acquireSelfUpgradeLock()
  if (!release)
    return {
      error: { kind: 'conflict', message: 'Another qtx upgrade is already running.' },
      kind: 'failure',
    }

  return {
    kind: 'success',
    value: {
      async release() {
        await release()
        return { kind: 'success', value: undefined }
      },
    },
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

export { acquireSelfUpgradeLock, createSelfUpgradeLockPort, getSelfUpgradeLockPath } from './lock'
export { createSelfInstallSourcePersistencePort } from './state-persistence'
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
