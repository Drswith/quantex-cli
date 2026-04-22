import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { BUILD_PACKAGE_NAME, BUILD_REPOSITORY_URL, BUILD_VERSION } from '../generated/build-meta'
import * as bunPm from '../package-manager/bun'
import * as npmPm from '../package-manager/npm'
import { getLatestVersion } from '../utils/version'
import { upgradeStandaloneBinary } from './binary'

export type SelfInstallSource = 'binary' | 'bun' | 'npm' | 'source' | 'unknown'

export interface SelfInspection {
  canAutoUpdate: boolean
  currentVersion: string
  executablePath: string
  installSource: SelfInstallSource
  latestVersion?: string
  packageRoot: string
  recommendedUpgradeCommand?: string
}

export interface SelfUpdateResult {
  installSource: SelfInstallSource
  success: boolean
}

export interface SelfPackageMetadata {
  packageJsonPath: string
  packageRoot: string
  version: string
}

const CLI_NPM_PACKAGE_NAME = BUILD_PACKAGE_NAME
const BUN_GLOBAL_PATH_SEGMENT = '/.bun/install/global/'
const NODE_MODULES_SEGMENT = `/node_modules/${CLI_NPM_PACKAGE_NAME}`

export async function inspectSelf(): Promise<SelfInspection> {
  const metadata = await resolveSelfPackageMetadata()
  const latestVersion = await getLatestVersion(CLI_NPM_PACKAGE_NAME)
  const executablePath = process.execPath
  const installSource = detectSelfInstallSource(metadata.packageRoot, executablePath)

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

  if (resolvedInspection.installSource === 'bun') {
    return {
      installSource: resolvedInspection.installSource,
      success: await bunPm.update(CLI_NPM_PACKAGE_NAME),
    }
  }

  if (resolvedInspection.installSource === 'npm') {
    return {
      installSource: resolvedInspection.installSource,
      success: await npmPm.update(CLI_NPM_PACKAGE_NAME),
    }
  }

  if (resolvedInspection.installSource === 'binary') {
    const downloadUrl = getBinaryReleaseDownloadUrl(resolvedInspection.executablePath)

    return {
      installSource: resolvedInspection.installSource,
      success: downloadUrl
        ? await upgradeStandaloneBinary(downloadUrl, resolvedInspection.executablePath)
        : false,
    }
  }

  return {
    installSource: resolvedInspection.installSource,
    success: false,
  }
}

export function canAutoUpdateSelf(installSource: SelfInstallSource): boolean {
  return installSource === 'binary' || installSource === 'bun' || installSource === 'npm'
}

export function detectSelfInstallSource(packageRoot: string, executablePath: string = process.execPath): SelfInstallSource {
  const normalizedPath = normalizePath(packageRoot)

  if (normalizedPath.includes(BUN_GLOBAL_PATH_SEGMENT))
    return 'bun'

  if (normalizedPath.includes(NODE_MODULES_SEGMENT))
    return 'npm'

  if (isStandaloneBinaryExecutable(executablePath))
    return 'binary'

  if (normalizedPath)
    return 'source'

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
  if (installSource === 'bun')
    return `bun add -g ${CLI_NPM_PACKAGE_NAME}@latest`

  if (installSource === 'npm')
    return `npm install -g ${CLI_NPM_PACKAGE_NAME}@latest`

  if (installSource === 'binary') {
    const downloadUrl = getBinaryReleaseDownloadUrl(executablePath)
    return downloadUrl ? `download and replace the binary from ${downloadUrl}` : undefined
  }

  return undefined
}

export function getBinaryReleaseAssetName(executablePath: string = process.execPath): string | undefined {
  const normalizedPath = normalizePath(executablePath)
  const executableName = basename(normalizedPath)

  if (executableName.endsWith('.exe'))
    return 'quantex-windows-x64.exe'

  if (process.platform === 'darwin')
    return process.arch === 'arm64' ? 'quantex-darwin-arm64' : 'quantex-darwin-x64'

  if (process.platform === 'linux')
    return process.arch === 'arm64' ? 'quantex-linux-arm64' : 'quantex-linux-x64'

  return undefined
}

export function getBinaryReleaseDownloadUrl(executablePath: string = process.execPath): string | undefined {
  const assetName = getBinaryReleaseAssetName(executablePath)
  if (!assetName || !BUILD_REPOSITORY_URL)
    return undefined

  return `${BUILD_REPOSITORY_URL}/releases/latest/download/${assetName}`
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
