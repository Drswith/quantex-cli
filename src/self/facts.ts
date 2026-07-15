import type { PersistencePort, RuntimeFailure } from '../runtime'
import type { SelfInstallFacts, SelfInstallSource, SelfPackageMetadata, SelfUpdateChannel } from './types'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config'
import { BUILD_PACKAGE_NAME, BUILD_VERSION } from '../generated/build-meta'
import { ProcessInterruptionError } from '../utils/child-process'
import { getSelfUpdateChannel } from './release'
import { SELF_INSTALL_SOURCE_PERSISTENCE_KEY, createSelfInstallSourcePersistencePort } from './state-persistence'

const CLI_NPM_PACKAGE_NAME = BUILD_PACKAGE_NAME
const BUN_GLOBAL_PATH_SEGMENT = '/.bun/install/global/'
const NODE_MODULES_SEGMENT = `/node_modules/${CLI_NPM_PACKAGE_NAME}`

export async function resolveSelfInstallFacts(options?: {
  persistence?: PersistencePort
  signal?: AbortSignal
  updateChannel?: SelfUpdateChannel
}): Promise<SelfInstallFacts> {
  return resolveSelfInstallFactsWithPersistence(options, true)
}

export async function resolveSelfInstallFactsReadOnly(options?: {
  persistence?: PersistencePort
  signal?: AbortSignal
  updateChannel?: SelfUpdateChannel
}): Promise<SelfInstallFacts> {
  return resolveSelfInstallFactsWithPersistence(options, false)
}

async function resolveSelfInstallFactsWithPersistence(
  options: { persistence?: PersistencePort; signal?: AbortSignal; updateChannel?: SelfUpdateChannel } | undefined,
  persistDetectedSource: boolean,
): Promise<SelfInstallFacts> {
  const metadata = await resolveSelfPackageMetadata()
  const executablePath = process.execPath
  const detectedInstallSource = metadata.foundPackageJson
    ? detectSelfInstallSource(metadata.packageRoot)
    : detectSelfInstallSource('', executablePath)
  const persistence = options?.persistence ?? createSelfInstallSourcePersistencePort()
  const signal = options?.signal ?? new AbortController().signal
  const storedInstallSource = await loadSelfInstallSource(persistence, signal)
  const installSource = persistDetectedSource
    ? await reconcileSelfInstallSource(storedInstallSource, detectedInstallSource, { persistence, signal })
    : resolveSelfInstallSource(storedInstallSource, detectedInstallSource)
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

export function resolveSelfInstallSource(
  storedInstallSource: SelfInstallSource | undefined,
  detectedInstallSource: SelfInstallSource,
): SelfInstallSource {
  return detectedInstallSource !== 'unknown' ? detectedInstallSource : (storedInstallSource ?? detectedInstallSource)
}

export function canAutoUpdateSelf(installSource: SelfInstallSource): boolean {
  return installSource === 'binary' || installSource === 'bun' || installSource === 'npm'
}

export async function reconcileSelfInstallSource(
  storedInstallSource: SelfInstallSource | undefined,
  detectedInstallSource: SelfInstallSource,
  options?: { persistence?: PersistencePort; signal?: AbortSignal },
): Promise<SelfInstallSource> {
  if (detectedInstallSource !== 'unknown' && storedInstallSource !== detectedInstallSource) {
    const outcome = await (options?.persistence ?? createSelfInstallSourcePersistencePort()).save({
      key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY,
      signal: options?.signal ?? new AbortController().signal,
      value: detectedInstallSource,
    })
    if (outcome.kind === 'failure') throwPersistenceFailure(outcome.error)
    return detectedInstallSource
  }

  return resolveSelfInstallSource(storedInstallSource, detectedInstallSource)
}

async function loadSelfInstallSource(
  persistence: PersistencePort,
  signal: AbortSignal,
): Promise<SelfInstallSource | undefined> {
  const outcome = await persistence.load({ key: SELF_INSTALL_SOURCE_PERSISTENCE_KEY, signal })
  if (outcome.kind === 'failure') throwPersistenceFailure(outcome.error)
  if (outcome.value.kind === 'missing') return undefined
  const value = outcome.value.snapshot.value
  if (value === 'binary' || value === 'bun' || value === 'npm' || value === 'source' || value === 'unknown')
    return value
  throw new Error('The persisted self install source is invalid.')
}

function throwPersistenceFailure(error: RuntimeFailure): never {
  const cause = error.details?.cause
  if (cause instanceof Error) throw cause
  if (error.kind === 'cancelled') throw new ProcessInterruptionError({ kind: 'cancelled', reason: error.message })
  if (error.kind === 'timed-out') throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: 0 })
  throw new Error(error.message)
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
