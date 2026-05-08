import type { SelfInspection, SelfInstallFacts, SelfUpdateResult, SelfUpdateTarget, SelfUpgradePlan } from './types'
import { join } from 'node:path'
import process from 'node:process'
import { loadConfig } from '../config'
import { BUILD_PACKAGE_NAME } from '../generated/build-meta'
import { OFFICIAL_NPM_REGISTRY } from '../utils/registry'
import { compareVersions, getInstalledVersion, getLatestVersion, isVersionNewer } from '../utils/version'
import { resolveSelfInstallFacts } from './facts'
import { resolveManagedSelfUpdateRegistry } from './registry'
import { fetchBinaryReleaseManifest, resolveBinaryReleaseAsset } from './release'

export async function resolveSelfUpdateTarget(facts: SelfInstallFacts): Promise<SelfUpdateTarget> {
  const config = await loadConfig()

  if (facts.installSource === 'binary') {
    try {
      const manifest = await fetchBinaryReleaseManifest(facts.updateChannel)
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
    } catch {
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
    registry: OFFICIAL_NPM_REGISTRY,
  })

  if (facts.installSource === 'bun' || facts.installSource === 'npm') {
    const managedRegistry = await resolveManagedSelfUpdateRegistry(facts.installSource, config)

    return {
      managedRegistry: managedRegistry?.registry,
      managedRegistryIsOverride: managedRegistry?.isOverride ?? false,
      packageTag,
      targetVersion: await getLatestVersion(BUILD_PACKAGE_NAME, packageTag, {
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
  facts?: SelfInstallFacts
  target?: SelfUpdateTarget
  updateChannel?: SelfInstallFacts['updateChannel']
}): Promise<SelfUpgradePlan> {
  const facts = options?.facts ?? (await resolveSelfInstallFacts({ updateChannel: options?.updateChannel }))
  const target = options?.target ?? (await resolveSelfUpdateTarget(facts))
  const updateAvailable = target.targetVersion ? isVersionNewer(target.targetVersion, facts.currentVersion) : false

  return {
    facts,
    status: resolveSelfUpgradePlanStatus(facts, target, updateAvailable),
    target,
    updateAvailable,
  }
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
): Promise<SelfUpdateResult> {
  if (!result.success) return result

  if (plan.facts.installSource !== 'bun' && plan.facts.installSource !== 'npm') return result

  const observedVersion = await getInstalledSelfVersion(plan)
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

async function getInstalledSelfVersion(plan: SelfUpgradePlan): Promise<string | undefined> {
  if (plan.target.verificationCommand) {
    const managedVersion = await getInstalledVersion(plan.facts.executablePath, {
      command: plan.target.verificationCommand,
    })

    if (managedVersion) return managedVersion
  }

  return getInstalledVersion(plan.facts.executablePath)
}

function getManagedSelfVersionProbeCommand(packageRoot: string): string[] | undefined {
  if (!packageRoot) return undefined

  return [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version']
}
