import type { SelfInspection, SelfInstallSource, SelfPackageMetadata, SelfUpdateResult } from './types'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { BUILD_PACKAGE_NAME, BUILD_VERSION } from '../generated/build-meta'
import { getSelfState, setSelfInstallSource } from '../state'
import { getLatestVersion } from '../utils/version'
import { getSelfUpgradeProvider } from './providers'
import { getSelfUpgradeRecoveryHint } from './recovery'

const CLI_NPM_PACKAGE_NAME = BUILD_PACKAGE_NAME
const BUN_GLOBAL_PATH_SEGMENT = '/.bun/install/global/'
const NODE_MODULES_SEGMENT = `/node_modules/${CLI_NPM_PACKAGE_NAME}`

export async function inspectSelf(): Promise<SelfInspection> {
  const metadata = await resolveSelfPackageMetadata()
  const latestVersion = await getLatestVersion(CLI_NPM_PACKAGE_NAME)
  const executablePath = process.execPath
  const detectedInstallSource = metadata.foundPackageJson
    ? detectSelfInstallSource(metadata.packageRoot)
    : detectSelfInstallSource('', executablePath)
  const state = await getSelfState()
  const installSource = await resolveSelfInstallSource(state.installSource, detectedInstallSource)

  return {
    canAutoUpdate: canAutoUpdateSelf(installSource),
    currentVersion: metadata.version || BUILD_VERSION,
    executablePath,
    installSource,
    latestVersion,
    packageRoot: metadata.packageRoot,
    recommendedUpgradeCommand: canAutoUpdateSelf(installSource) ? 'quantex upgrade' : undefined,
  }
}

export async function upgradeSelf(inspection?: SelfInspection): Promise<SelfUpdateResult> {
  const resolvedInspection = inspection ?? await inspectSelf()
  return getSelfUpgradeProvider(resolvedInspection).upgrade(resolvedInspection)
}

export function canAutoUpdateSelf(installSource: SelfInstallSource): boolean {
  return installSource === 'binary' || installSource === 'bun' || installSource === 'npm'
}

async function resolveSelfInstallSource(
  storedInstallSource: SelfInstallSource | undefined,
  detectedInstallSource: SelfInstallSource,
): Promise<SelfInstallSource> {
  if (detectedInstallSource !== 'unknown' && storedInstallSource !== detectedInstallSource) {
    await setSelfInstallSource(detectedInstallSource)
    return detectedInstallSource
  }

  return storedInstallSource ?? detectedInstallSource
}

export function detectSelfInstallSource(packageRoot: string, executablePath: string = process.execPath): SelfInstallSource {
  const normalizedPath = normalizePath(packageRoot)

  if (normalizedPath.includes(BUN_GLOBAL_PATH_SEGMENT))
    return 'bun'

  if (normalizedPath.includes(NODE_MODULES_SEGMENT))
    return 'npm'

  if (normalizedPath)
    return 'source'

  if (isStandaloneBinaryExecutable(executablePath))
    return 'binary'

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
    if (parentDir === currentDir)
      break
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

async function readPackageJson(packageJsonPath: string): Promise<{ name?: string, version?: string } | undefined> {
  try {
    return JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string, version?: string }
  }
  catch {
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
  }
  catch {
    return process.execPath
  }
}

export { getSelfUpgradeRecoveryHint, getSelfUpgradeRecoveryHintForInspection } from './recovery'
export { getBinaryReleaseAssetName, getBinaryReleaseDownloadUrl } from './release'
export type { SelfInspection, SelfInstallSource, SelfPackageMetadata, SelfUpdateResult } from './types'
