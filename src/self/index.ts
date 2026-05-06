import type {
  SelfInspection,
  SelfInstallSource,
  SelfPackageMetadata,
  SelfUpdateChannel,
  SelfUpdateResult,
} from './types'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config'
import { BUILD_PACKAGE_NAME, BUILD_VERSION } from '../generated/build-meta'
import { getSelfState, setSelfInstallSource } from '../state'
import { OFFICIAL_NPM_REGISTRY } from '../utils/registry'
import { getInstalledVersion, getLatestVersion } from '../utils/version'
import { acquireSelfUpgradeLock } from './lock'
import { getSelfUpgradeProvider } from './providers'
import { getSelfUpgradeRecoveryHint } from './recovery'
import { resolveManagedSelfUpdateRegistry } from './registry'
import { fetchBinaryReleaseManifest, getSelfUpdateChannel, resolveBinaryReleaseAsset } from './release'

const CLI_NPM_PACKAGE_NAME = BUILD_PACKAGE_NAME
const BUN_GLOBAL_PATH_SEGMENT = '/.bun/install/global/'
const NODE_MODULES_SEGMENT = `/node_modules/${CLI_NPM_PACKAGE_NAME}`

export async function inspectSelf(options?: { updateChannel?: SelfUpdateChannel }): Promise<SelfInspection> {
  const metadata = await resolveSelfPackageMetadata()
  const executablePath = process.execPath
  const detectedInstallSource = metadata.foundPackageJson
    ? detectSelfInstallSource(metadata.packageRoot)
    : detectSelfInstallSource('', executablePath)
  const state = await getSelfState()
  const installSource = await reconcileSelfInstallSource(state.installSource, detectedInstallSource)
  const config = await loadConfig()
  const updateChannel = getSelfUpdateChannel(options?.updateChannel, config.selfUpdateChannel)
  const latestVersionState = await resolveSelfLatestVersion(installSource, executablePath, updateChannel, config)

  return {
    canAutoUpdate: canAutoUpdateSelf(installSource),
    currentVersion: metadata.version || BUILD_VERSION,
    executablePath,
    installSource,
    latestVersion: latestVersionState.installableLatestVersion,
    managedRegistry: latestVersionState.managedRegistry,
    managedRegistryIsOverride: latestVersionState.managedRegistryIsOverride,
    packageRoot: metadata.packageRoot,
    recommendedUpgradeCommand: canAutoUpdateSelf(installSource) ? 'quantex upgrade' : undefined,
    upstreamLatestVersion: latestVersionState.upstreamLatestVersion,
    updateChannel,
  }
}

export async function upgradeSelf(inspection?: SelfInspection): Promise<SelfUpdateResult> {
  const resolvedInspection = inspection ?? (await inspectSelf())
  const releaseLock = await acquireSelfUpgradeLock()

  if (!releaseLock) {
    return {
      error: {
        kind: 'locked',
        message: 'Another qtx upgrade is already running.',
      },
      installSource: resolvedInspection.installSource,
      success: false,
    }
  }

  try {
    const result = await getSelfUpgradeProvider(resolvedInspection).upgrade(resolvedInspection)
    return verifyManagedSelfUpgradeResult(resolvedInspection, result)
  } finally {
    await releaseLock()
  }
}

export function canAutoUpdateSelf(installSource: SelfInstallSource): boolean {
  return installSource === 'binary' || installSource === 'bun' || installSource === 'npm'
}

export async function reconcileSelfInstallSource(
  storedInstallSource: SelfInstallSource | undefined,
  detectedInstallSource: SelfInstallSource,
): Promise<SelfInstallSource> {
  if (detectedInstallSource !== 'unknown' && storedInstallSource !== detectedInstallSource) {
    await setSelfInstallSource(detectedInstallSource)
    return detectedInstallSource
  }

  return storedInstallSource ?? detectedInstallSource
}

export function detectSelfInstallSource(
  packageRoot: string,
  executablePath: string = process.execPath,
): SelfInstallSource {
  const normalizedPath = normalizePath(packageRoot)

  if (normalizedPath.includes(BUN_GLOBAL_PATH_SEGMENT)) return 'bun'

  if (normalizedPath.includes(NODE_MODULES_SEGMENT)) return 'npm'

  if (normalizedPath) return 'source'

  if (isStandaloneBinaryExecutable(executablePath)) return 'binary'

  return 'unknown'
}

export async function resolveSelfPackageMetadata(moduleUrl: string = import.meta.url): Promise<SelfPackageMetadata> {
  const modulePath = resolveModulePath(moduleUrl)
  let currentDir = dirname(modulePath)

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json')
    const packageJson = await readPackageJson(packageJsonPath)

    if (packageJson?.name === CLI_NPM_PACKAGE_NAME) {
      return {
        foundPackageJson: true,
        packageJsonPath,
        packageRoot: currentDir,
        version: packageJson.version ?? BUILD_VERSION,
      }
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  return {
    foundPackageJson: false,
    packageJsonPath: join(dirname(modulePath), 'package.json'),
    packageRoot: dirname(modulePath),
    version: BUILD_VERSION,
  }
}

export function getSelfVersion(): string {
  return BUILD_VERSION
}

export function getManualSelfUpgradeCommand(
  installSource: SelfInstallSource,
  executablePath: string = process.execPath,
): string | undefined {
  return getSelfUpgradeRecoveryHint(installSource, executablePath)
}

async function resolveSelfLatestVersion(
  installSource: SelfInstallSource,
  executablePath: string,
  updateChannel: SelfUpdateChannel,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<{
  installableLatestVersion?: string
  managedRegistry?: string
  managedRegistryIsOverride?: boolean
  upstreamLatestVersion?: string
}> {
  if (installSource === 'binary') {
    try {
      const manifest = await fetchBinaryReleaseManifest(updateChannel)
      const asset = resolveBinaryReleaseAsset(manifest, executablePath)
      return {
        installableLatestVersion: asset ? manifest.version : undefined,
      }
    } catch {
      return {}
    }
  }

  const distTag = updateChannel === 'beta' ? 'beta' : 'latest'
  const upstreamLatestVersion = await getLatestVersion(CLI_NPM_PACKAGE_NAME, distTag, {
    registry: OFFICIAL_NPM_REGISTRY,
  })

  if (installSource === 'bun' || installSource === 'npm') {
    const managedRegistry = await resolveManagedSelfUpdateRegistry(installSource, config)
    return {
      installableLatestVersion: await getLatestVersion(CLI_NPM_PACKAGE_NAME, distTag, {
        registry: managedRegistry?.registry,
      }),
      managedRegistry: managedRegistry?.registry,
      managedRegistryIsOverride: managedRegistry?.isOverride ?? false,
      upstreamLatestVersion,
    }
  }

  return {
    installableLatestVersion: upstreamLatestVersion,
    upstreamLatestVersion,
  }
}

async function verifyManagedSelfUpgradeResult(
  inspection: SelfInspection,
  result: SelfUpdateResult,
): Promise<SelfUpdateResult> {
  if (!result.success) return result

  if (inspection.installSource !== 'bun' && inspection.installSource !== 'npm') return result

  const observedVersion = await getManagedInstalledSelfVersion(inspection)
  if (!observedVersion) {
    return {
      error: {
        kind: 'verify',
        message: 'Managed self-upgrade finished but Quantex could not verify the installed version afterwards.',
      },
      installSource: inspection.installSource,
      success: false,
    }
  }

  const expectedVersion = result.newVersion ?? inspection.latestVersion
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
      installSource: inspection.installSource,
      success: false,
    }
  }

  if (!expectedVersion && observedVersion === inspection.currentVersion && inspection.latestVersion !== undefined) {
    return {
      error: {
        detail: {
          observedVersion,
        },
        kind: 'verify',
        message: 'Managed self-upgrade completed without changing the installed Quantex version.',
      },
      installSource: inspection.installSource,
      success: false,
    }
  }

  return {
    ...result,
    newVersion: observedVersion,
  }
}

async function getManagedInstalledSelfVersion(inspection: SelfInspection): Promise<string | undefined> {
  const managedVersionProbe = getManagedSelfVersionProbeCommand(inspection.packageRoot)

  if (managedVersionProbe) {
    const managedVersion = await getInstalledVersion(inspection.executablePath, {
      command: managedVersionProbe,
    })

    if (managedVersion) return managedVersion
  }

  return getInstalledVersion(inspection.executablePath)
}

function getManagedSelfVersionProbeCommand(packageRoot: string): string[] | undefined {
  if (!packageRoot) return undefined

  return [process.execPath, join(packageRoot, 'dist', 'cli.mjs'), '--version']
}

async function readPackageJson(packageJsonPath: string): Promise<{ name?: string; version?: string } | undefined> {
  try {
    return JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string; version?: string }
  } catch {
    return undefined
  }
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').toLowerCase()
}

function isStandaloneBinaryExecutable(executablePath: string): boolean {
  const executableName = basename(normalizePath(executablePath))
  return executableName !== 'bun' && executableName !== 'bun.exe'
}

function resolveModulePath(moduleUrl: string): string {
  try {
    return fileURLToPath(moduleUrl)
  } catch {
    return process.execPath
  }
}

export { acquireSelfUpgradeLock, getSelfUpgradeLockPath } from './lock'
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
  SelfInstallSource,
  SelfPackageMetadata,
  SelfUpdateChannel,
  SelfUpdateResult,
} from './types'
