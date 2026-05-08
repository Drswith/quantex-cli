import type { SelfInstallFacts, SelfInstallSource, SelfPackageMetadata, SelfUpdateChannel } from './types'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config'
import { BUILD_PACKAGE_NAME, BUILD_VERSION } from '../generated/build-meta'
import { getSelfState, setSelfInstallSource } from '../state'
import { getSelfUpdateChannel } from './release'

const CLI_NPM_PACKAGE_NAME = BUILD_PACKAGE_NAME
const BUN_GLOBAL_PATH_SEGMENT = '/.bun/install/global/'
const NODE_MODULES_SEGMENT = `/node_modules/${CLI_NPM_PACKAGE_NAME}`

export async function resolveSelfInstallFacts(options?: {
  updateChannel?: SelfUpdateChannel
}): Promise<SelfInstallFacts> {
  const metadata = await resolveSelfPackageMetadata()
  const executablePath = process.execPath
  const detectedInstallSource = metadata.foundPackageJson
    ? detectSelfInstallSource(metadata.packageRoot)
    : detectSelfInstallSource('', executablePath)
  const state = await getSelfState()
  const installSource = await reconcileSelfInstallSource(state.installSource, detectedInstallSource)
  const config = await loadConfig()
  const updateChannel = getSelfUpdateChannel(options?.updateChannel, config.selfUpdateChannel)

  return {
    canAutoUpdate: canAutoUpdateSelf(installSource),
    currentVersion: metadata.version || BUILD_VERSION,
    executablePath,
    installSource,
    packageRoot: metadata.packageRoot,
    updateChannel,
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
