import type { ProviderOperationContext } from '../providers'
import type { CachePort, NetworkPort, PersistencePort, ProcessPort } from '../runtime'
import type { SelfInspection, SelfInstallFacts, SelfUpdateResult, SelfUpdateTarget, SelfUpgradePlan } from './types'
import { join } from 'node:path'
import process from 'node:process'
import { loadConfig } from '../config'
import { BUILD_PACKAGE_NAME } from '../generated/build-meta'
import { isProcessInterruptionError, ProcessInterruptionError } from '../utils/child-process'
import { OFFICIAL_NPM_REGISTRY } from '../utils/registry'
import { compareVersions, getInstalledVersion, getLatestVersion, isVersionNewer } from '../utils/version'
import { resolveSelfInstallFacts } from './facts'
import { resolveManagedSelfUpdateRegistry } from './registry'
import { fetchBinaryReleaseManifest, resolveBinaryReleaseAsset } from './release'
import { createSelfUpdateMetadata, writeSelfUpdateMetadata } from './update-metadata'

export async function resolveSelfUpdateTarget(
  facts: SelfInstallFacts,
  context?: ProviderOperationContext,
  networkPort?: NetworkPort,
): Promise<SelfUpdateTarget> {
  const config = await loadConfig()

  if (facts.installSource === 'binary') {
    try {
      const manifest = context
        ? await fetchBinaryReleaseManifest(facts.updateChannel, context, networkPort)
        : await fetchBinaryReleaseManifest(facts.updateChannel, undefined, networkPort)
      const asset = resolveBinaryReleaseAsset(manifest, facts.executablePath)

      if (!asset) {
        return {
          resolutionError: {
            detail: {
              channel: facts.updateChannel,
            },
            kind: 'unsupported',
            message: `No binary asset is available for the current platform on the ${facts.updateChannel} channel.`,
          },
        }
      }

      return {
        binaryAsset: asset,
        targetVersion: manifest.version,
      }
    } catch (error) {
      if (isProcessInterruptionError(error)) throw error
      return {
        resolutionError: {
          kind: 'network',
          message: `Failed to resolve the ${facts.updateChannel} release manifest.`,
        },
      }
    }
  }

  const packageTag = facts.updateChannel === 'beta' ? 'beta' : 'latest'
  const upstreamLatestVersion = await getLatestVersion(BUILD_PACKAGE_NAME, packageTag, {
    ...(context ? { context } : {}),
    networkPort,
    registry: OFFICIAL_NPM_REGISTRY,
  })

  if (facts.installSource === 'bun' || facts.installSource === 'npm') {
    const managedRegistry = await resolveManagedSelfUpdateRegistry(facts.installSource, config)

    return {
      managedRegistry: managedRegistry?.registry,
      managedRegistryIsOverride: managedRegistry?.isOverride ?? false,
      packageTag,
      targetVersion: await getLatestVersion(BUILD_PACKAGE_NAME, packageTag, {
        ...(context ? { context } : {}),
        networkPort,
        registry: managedRegistry?.registry,
      }),
      upstreamLatestVersion,
      verificationCommand: getManagedSelfVersionProbeCommand(facts.packageRoot),
    }
  }

  return {
    packageTag,
    targetVersion: upstreamLatestVersion,
    upstreamLatestVersion,
  }
}

export async function planSelfUpgrade(options?: {
  context?: ProviderOperationContext
  facts?: SelfInstallFacts
  metadataCache?: CachePort
  metadataTtlMs?: number
  networkPort?: NetworkPort
  persistencePort?: PersistencePort
  nowMs?: number
  target?: SelfUpdateTarget
  updateChannel?: SelfInstallFacts['updateChannel']
}): Promise<SelfUpgradePlan> {
  const facts =
    options?.facts ??
    (await resolveSelfInstallFacts({
      persistence: options?.persistencePort,
      signal: options?.context?.signal,
      updateChannel: options?.updateChannel,
    }))
  const target = options?.target ?? (await resolveSelfUpdateTarget(facts, options?.context, options?.networkPort))
  const updateAvailable = target.targetVersion ? isVersionNewer(target.targetVersion, facts.currentVersion) : false

  const plan: SelfUpgradePlan = {
    facts,
    status: resolveSelfUpgradePlanStatus(facts, target, updateAvailable),
    target,
    updateAvailable,
  }

  if (options?.metadataCache && facts.canAutoUpdate && target.targetVersion) {
    const fetchedAtMs = options.nowMs ?? Date.now()
    const ttlMs = options.metadataTtlMs ?? (await loadConfig()).versionCacheTtlHours * 60 * 60 * 1000
    await writeSelfUpdateMetadata({
      cache: options.metadataCache,
      metadata: createSelfUpdateMetadata({
        expiresAtMs: fetchedAtMs + ttlMs,
        facts,
        fetchedAtMs,
        targetVersion: target.targetVersion,
      }),
      signal: options.context?.signal ?? new AbortController().signal,
    })
  }

  return plan
}

export function buildSelfInspectionFromPlan(plan: SelfUpgradePlan): SelfInspection {
  return {
    canAutoUpdate: plan.facts.canAutoUpdate,
    currentVersion: plan.facts.currentVersion,
    executablePath: plan.facts.executablePath,
    installSource: plan.facts.installSource,
    latestVersion: plan.target.targetVersion,
    managedRegistry: plan.target.managedRegistry,
    managedRegistryIsOverride: plan.target.managedRegistryIsOverride,
    packageRoot: plan.facts.packageRoot,
    recommendedUpgradeCommand: plan.facts.canAutoUpdate ? 'quantex upgrade' : undefined,
    upstreamLatestVersion: plan.target.upstreamLatestVersion,
    updateChannel: plan.facts.updateChannel,
  }
}

export async function verifySelfUpgradeResult(
  plan: SelfUpgradePlan,
  result: SelfUpdateResult,
  context?: { readonly process?: ProcessPort; readonly signal: AbortSignal; readonly timeoutMs?: number },
): Promise<SelfUpdateResult> {
  if (!result.success) return result

  if (plan.facts.installSource !== 'bun' && plan.facts.installSource !== 'npm') return result

  const observedVersion = await getInstalledSelfVersion(plan, context)
  if (!observedVersion) {
    return {
      error: {
        kind: 'verify',
        message: 'Managed self-upgrade finished but Quantex could not verify the installed version afterwards.',
      },
      installSource: plan.facts.installSource,
      success: false,
    }
  }

  const expectedVersion = result.newVersion ?? plan.target.targetVersion
  if (expectedVersion && observedVersion !== expectedVersion) {
    return {
      error: {
        detail: {
          expectedVersion,
          observedVersion,
        },
        kind: 'verify',
        message: `Managed self-upgrade installed version ${observedVersion}, but expected ${expectedVersion}.`,
      },
      installSource: plan.facts.installSource,
      success: false,
    }
  }

  if (!expectedVersion && observedVersion === plan.facts.currentVersion && plan.target.targetVersion !== undefined) {
    return {
      error: {
        detail: {
          observedVersion,
        },
        kind: 'verify',
        message: 'Managed self-upgrade completed without changing the installed Quantex version.',
      },
      installSource: plan.facts.installSource,
      success: false,
    }
  }

  return {
    ...result,
    newVersion: observedVersion,
  }
}

export function buildPlanFromInspection(inspection: SelfInspection): SelfUpgradePlan {
  const facts: SelfInstallFacts = {
    canAutoUpdate: inspection.canAutoUpdate,
    currentVersion: inspection.currentVersion,
    executablePath: inspection.executablePath,
    installSource: inspection.installSource,
    packageRoot: inspection.packageRoot,
    updateChannel: inspection.updateChannel,
  }
  const target: SelfUpdateTarget = {
    managedRegistry: inspection.managedRegistry,
    managedRegistryIsOverride: inspection.managedRegistryIsOverride,
    packageTag: inspection.updateChannel === 'beta' ? 'beta' : 'latest',
    targetVersion: inspection.latestVersion,
    upstreamLatestVersion: inspection.upstreamLatestVersion,
    verificationCommand: getManagedSelfVersionProbeCommand(inspection.packageRoot),
  }
  const updateAvailable = inspection.latestVersion
    ? isVersionNewer(inspection.latestVersion, inspection.currentVersion)
    : false

  return {
    facts,
    status: resolveSelfUpgradePlanStatus(facts, target, updateAvailable),
    target,
    updateAvailable,
  }
}

export function isResolvedLatestBehindCurrent(plan: SelfUpgradePlan): boolean {
  return plan.target.targetVersion
    ? compareVersions(plan.target.targetVersion, plan.facts.currentVersion) === -1
    : false
}

function resolveSelfUpgradePlanStatus(
  facts: SelfInstallFacts,
  target: SelfUpdateTarget,
  updateAvailable: boolean,
): SelfUpgradePlan['status'] {
  if (!facts.canAutoUpdate) return 'manual-required'
  if (target.targetVersion && !updateAvailable) return 'up-to-date'
  if (target.targetVersion) return 'update-available'
  return 'check-unavailable'
}

async function getInstalledSelfVersion(
  plan: SelfUpgradePlan,
  context?: { readonly process?: ProcessPort; readonly signal: AbortSignal; readonly timeoutMs?: number },
): Promise<string | undefined> {
  const processPort = context?.process
  if (processPort && context) {
    const processContext = { ...context, process: processPort }
    if (plan.target.verificationCommand) {
      const managedVersion = await probeSelfVersionWithProcess(plan.target.verificationCommand, processContext)
      if (managedVersion) return managedVersion
    }
    return probeSelfVersionWithProcess([plan.facts.executablePath, '--version'], processContext)
  }

  if (plan.target.verificationCommand) {
    const managedVersion = await getInstalledVersion(plan.facts.executablePath, {
      command: plan.target.verificationCommand,
    })

    if (managedVersion) return managedVersion
  }

  return getInstalledVersion(plan.facts.executablePath)
}

async function probeSelfVersionWithProcess(
  argv: readonly string[],
  context: { readonly process: ProcessPort; readonly signal: AbortSignal; readonly timeoutMs?: number },
): Promise<string | undefined> {
  const outcome = await context.process.run({
    argv,
    signal: context.signal,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeoutMs: context.timeoutMs,
  })
  if (outcome.kind === 'failure') {
    if (outcome.error.kind === 'cancelled')
      throw new ProcessInterruptionError({ kind: 'cancelled', reason: outcome.error.message })
    if (outcome.error.kind === 'timed-out')
      throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: context.timeoutMs ?? 0 })
    return undefined
  }
  if (outcome.value.exitCode !== 0 || !outcome.value.stdout) return undefined

  const firstLine = new TextDecoder().decode(outcome.value.stdout).trim().split('\n')[0]
  if (!firstLine) return undefined
  const match = firstLine.match(/v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i)
  return match?.[1] ?? firstLine
}

function getManagedSelfVersionProbeCommand(packageRoot: string): string[] | undefined {
  if (!packageRoot) return undefined

  return [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version']
}
