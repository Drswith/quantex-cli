import type { ProviderOperationContext, ProviderOutcome } from '../providers'
import type { PackageMutationOutcome } from './context-mutation'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  readProcessOutput,
  readProcessOutputWithContext,
  isProcessInterruptionError,
  spawnCommand,
} from '../utils/child-process'
import { normalizeRegistryUrl } from '../utils/registry'
import { runPackageMutationOutcome } from './context-mutation'
import { projectLegacyPackageMutation } from './mutation-outcome'

export type RegistryUpdateStrategy = 'latest-major' | 'respect-semver'

export async function install(packageName: string, distTag?: string, registry?: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => installOutcome(packageName, distTag, registry, context))
}

export function installOutcome(
  packageName: string,
  distTag: string | undefined,
  registry: string | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const targetPackage = distTag ? `${packageName}@${distTag}` : packageName
  const resolvedRegistry = normalizeRegistryUrl(registry)
  return runGlobalBunCommandWithTrustOutcome(
    ['bun', 'add', '-g', ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []), targetPackage],
    [packageName],
    context,
  )
}

export async function update(
  packageName: string,
  strategy: RegistryUpdateStrategy = 'latest-major',
  distTag: string = 'latest',
  registry?: string,
): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateOutcome(packageName, strategy, distTag, registry, context))
}

export function updateOutcome(
  packageName: string,
  strategy: RegistryUpdateStrategy,
  distTag: string,
  registry: string | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const targetPackage = distTag === 'latest' ? packageName : `${packageName}@${distTag}`
  const resolvedRegistry = normalizeRegistryUrl(registry)
  return runGlobalBunCommandWithTrustOutcome(
    [
      'bun',
      'update',
      '-g',
      ...(strategy === 'latest-major' ? ['--latest'] : []),
      ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []),
      targetPackage,
    ],
    [packageName],
    context,
  )
}

export async function updateMany(
  packageNames: string[],
  strategy: RegistryUpdateStrategy = 'latest-major',
): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packageNames, strategy, context))
}

export function updateManyOutcome(
  packageNames: string[],
  strategy: RegistryUpdateStrategy,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  if (packageNames.length === 0) return Promise.resolve({ kind: 'success', value: undefined })
  return runGlobalBunCommandWithTrustOutcome(
    ['bun', 'update', '-g', ...(strategy === 'latest-major' ? ['--latest'] : []), ...packageNames],
    packageNames,
    context,
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => uninstallOutcome(packageName, context))
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(['bun', 'remove', '-g', packageName], context, 'bun uninstall failed')
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

export interface BunPresenceProbeDependencies {
  readonly readGlobalManifest: () => Promise<string>
}

const defaultPresenceDependencies: BunPresenceProbeDependencies = {
  readGlobalManifest: () =>
    readFile(
      join(process.env.BUN_INSTALL_GLOBAL_DIR ?? join(homedir(), '.bun', 'install', 'global'), 'package.json'),
      'utf8',
    ),
}

async function readPackagePresence(
  packageName: string,
  dependencies: BunPresenceProbeDependencies = defaultPresenceDependencies,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['bun', 'pm', '-g', 'ls'], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: createPipedStdio(),
    })
    const { stderr, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    if (!stdout.trim()) {
      if (stderr.includes('No package.json was found for directory')) return { presence: 'absent' }
      if (stderr.includes('Lockfile not found')) {
        try {
          return { presence: classifyGlobalManifestPresence(await dependencies.readGlobalManifest(), packageName) }
        } catch {
          return { presence: 'unknown' }
        }
      }
      return { presence: 'unknown' }
    }

    const version = parseGlobalPackageVersion(stdout, packageName)
    if (version) return { presence: 'present', version }
    if (hasGlobalPackageEntry(stdout, packageName)) return { presence: 'present' }

    return { presence: 'absent' }
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  packageName: string,
  dependencies: BunPresenceProbeDependencies = defaultPresenceDependencies,
  context?: ProviderOperationContext,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(packageName, dependencies, context)).presence
}

export async function getInstalledVersion(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return (await readPackagePresence(packageName, defaultPresenceDependencies, context)).version
}

function hasGlobalPackageEntry(output: string, packageName: string): boolean {
  const marker = `${packageName}@`

  return output.split('\n').some(line => line.trim().split(/\s+/).at(-1)?.startsWith(marker))
}

function classifyGlobalManifestPresence(manifestText: string, packageName: string): PackagePresenceProbe {
  const manifest = JSON.parse(manifestText) as unknown
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) return 'unknown'

  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    if (!Object.hasOwn(manifest, field)) continue
    const dependencies = (manifest as Record<string, unknown>)[field]
    if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) return 'unknown'
    if (Object.hasOwn(dependencies, packageName)) return 'present'
  }

  return 'absent'
}

export function parseGlobalPackageVersion(output: string, packageName: string): string | undefined {
  const marker = `${packageName}@`

  for (const line of output.split('\n')) {
    const packageToken = line.trim().split(/\s+/).at(-1)
    if (!packageToken?.startsWith(marker)) continue

    const version = packageToken.slice(marker.length)
    if (version) return version
  }

  return undefined
}

async function runGlobalBunCommandWithTrustOutcome(
  command: string[],
  packageNames: string[],
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const uniquePackageNames = [...new Set(packageNames)]
  const shouldRollbackOnTrustFailure = command[1] === 'add'
  const preAddPresence = shouldRollbackOnTrustFailure
    ? await readPreAddPackagePresence(uniquePackageNames, context)
    : undefined

  const mutation = await runPackageMutationOutcome(command, context, 'bun mutation failed')
  if (mutation.kind !== 'success') return mutation

  const trust = await trustBlockedGlobalPackagesOutcome(uniquePackageNames, context)
  if (trust.kind !== 'success' && shouldRollbackOnTrustFailure && preAddPresence) {
    const packagesToRollback = uniquePackageNames.filter(packageName => preAddPresence.get(packageName) === 'absent')
    await rollbackGlobalBunPackages(packagesToRollback, context)
  }
  return trust
}

async function readPreAddPackagePresence(
  packageNames: string[],
  context: ProviderOperationContext,
): Promise<Map<string, PackagePresenceProbe>> {
  const presenceByPackage = new Map<string, PackagePresenceProbe>()
  for (const packageName of packageNames) {
    presenceByPackage.set(packageName, await probePackagePresence(packageName, undefined, context))
  }
  return presenceByPackage
}

async function rollbackGlobalBunPackages(packageNames: string[], context: ProviderOperationContext): Promise<void> {
  for (const packageName of new Set(packageNames)) {
    await runPackageMutationOutcome(['bun', 'remove', '-g', packageName], context, 'bun rollback failed').catch(
      () => undefined,
    )
  }
}

async function trustBlockedGlobalPackagesOutcome(
  packageNames: string[],
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const requestedPackages = [...new Set(packageNames)]
  if (requestedPackages.length === 0) return { kind: 'success', value: undefined }

  const output = await readGlobalUntrustedPackagesOutcome(context)
  if (output.kind !== 'success') return output

  const untrustedPackages = parseUntrustedPackages(output.value)
  const blockedPackages = requestedPackages.filter(packageName => untrustedPackages.has(packageName))

  if (blockedPackages.length === 0) return { kind: 'success', value: undefined }

  return runPackageMutationOutcome(['bun', 'pm', '-g', 'trust', ...blockedPackages], context, 'bun trust failed')
}

async function readGlobalUntrustedPackagesOutcome(context: ProviderOperationContext): Promise<ProviderOutcome<string>> {
  const command = ['bun', 'pm', '-g', 'untrusted']
  try {
    const proc = spawnCommand(command, {
      detached: process.platform !== 'win32',
      stdio: createPipedStdio(),
    })
    const { exitCode, stdout } = await readProcessOutputWithContext(proc, context)

    if (exitCode !== 0) {
      return {
        command,
        exitCode,
        kind: 'failed',
        reason: `bun trust inspection failed with exit code ${exitCode}`,
        retryable: false,
      }
    }

    return { kind: 'success', value: stdout }
  } catch (error) {
    if (isProcessInterruptionError(error)) {
      return error.kind === 'timed-out'
        ? { kind: 'timed-out', timeoutMs: error.timeoutMs ?? context.timeoutMs ?? 0 }
        : { kind: 'cancelled', ...(error.reason ? { reason: error.reason } : {}) }
    }
    return {
      command,
      kind: 'failed',
      reason: error instanceof Error && error.message.trim() ? error.message : 'bun trust inspection failed',
      retryable: false,
    }
  }
}

export function parseUntrustedPackages(output: string): Set<string> {
  const packages = new Set<string>()

  for (const line of output.split('\n')) {
    const normalizedLine = line.replaceAll('\\', '/')
    const match = normalizedLine.match(/^\.\/node_modules\/(.+?) @/)
    if (match?.[1]) packages.add(match[1])
  }

  return packages
}

function createPipedStdio(): ['ignore', 'pipe', 'pipe'] {
  return ['ignore', 'pipe', 'pipe']
}
