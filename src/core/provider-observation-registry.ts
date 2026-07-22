import type { ProviderRegistry } from '../providers/registry'
import type {
  ProviderAdapter,
  ProviderId,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
} from '../providers/types'
import type { ReadOnlyCommandResult } from './read-only-process'
import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { CoreProcessInterruptionError, runReadOnlyCommand } from './read-only-process'

type PackagePresence = 'absent' | 'present' | 'unknown'

interface PackageProbe {
  readonly presence: PackagePresence
  readonly version?: string
}

export interface CoreProviderObservationDependencies {
  readonly access: (path: string) => Promise<void>
  readonly env: Readonly<NodeJS.ProcessEnv>
  readonly homeDir: () => string
  readonly platform: NodeJS.Platform
  readonly readFile: (path: string) => Promise<string>
  readonly runCommand: (argv: readonly string[], context: ProviderOperationContext) => Promise<ReadOnlyCommandResult>
}

const defaultDependencies: CoreProviderObservationDependencies = {
  access: path => access(path),
  env: process.env,
  homeDir: homedir,
  platform: process.platform,
  readFile: path => readFile(path, 'utf8'),
  runCommand: runReadOnlyCommand,
}

export function createCoreProviderObservationRegistry(
  dependencies: CoreProviderObservationDependencies = defaultDependencies,
): ProviderRegistry {
  return createObservationRegistry([
    createPackageAdapter('bun', 'bun', dependencies, (target, context) => probeBun(target.id, context, dependencies)),
    createPackageAdapter('npm', 'npm', dependencies, (target, context) => probeNpm(target.id, context, dependencies)),
    createPackageAdapter('brew', 'brew', dependencies, (target, context) => probeBrew(target, context, dependencies)),
    createPackageAdapter('cargo', 'cargo', dependencies, (target, context) =>
      probeCargo(target.id, context, dependencies),
    ),
    createPackageAdapter('deno', 'deno', dependencies, (target, context) => probeDeno(target, context, dependencies)),
    createPackageAdapter('mise', 'mise', dependencies, (target, context) =>
      probeMise(target.id, context, dependencies),
    ),
    createPackageAdapter('pip', 'pip', dependencies, (target, context) => probePip(target.id, context, dependencies)),
    createPackageAdapter('uv', 'uv', dependencies, (target, context) => probeUv(target.id, context, dependencies)),
    createPackageAdapter('winget', 'winget', dependencies, (target, context) =>
      probeWinget(target.id, context, dependencies),
    ),
    createExecutableAdapter('script', dependencies),
    createExecutableAdapter('binary', dependencies),
  ])
}

function createObservationRegistry(adapters: readonly ProviderAdapter[]): ProviderRegistry {
  const adapterList = Object.freeze([...adapters])
  const adaptersById = new Map(adapterList.map(adapter => [adapter.id, adapter] as const))
  if (adaptersById.size !== adapterList.length) throw new Error('Duplicate Core provider observation adapter id.')
  const capabilities = Object.freeze(['availability', 'observe'] as const)
  const unavailable = Object.freeze([])
  return Object.freeze({
    get: (id: ProviderId) => adaptersById.get(id),
    getCapabilities: (id: ProviderId) => (adaptersById.has(id) ? capabilities : unavailable),
    list: () => adapterList,
  })
}

function createPackageAdapter<Id extends Exclude<ProviderId, 'binary' | 'script'>>(
  id: Id,
  executable: string,
  dependencies: CoreProviderObservationDependencies,
  probe: (target: ProviderTarget, context: ProviderOperationContext) => Promise<PackageProbe>,
): ProviderAdapter & { readonly id: Id } {
  return {
    availability: context => observeAvailability(executable, context, dependencies),
    id,
    async observe(request) {
      const result = await probe(request.target, request.context)
      if (result.presence === 'unknown') {
        return {
          evidence: [{ kind: 'provider', value: `${id}:${request.target.id}:presence-unknown` }],
          kind: 'indeterminate',
          reason: `${id} could not determine whether ${request.target.id} is installed`,
        }
      }
      return success({
        evidence: [
          {
            kind: 'package',
            value:
              result.presence === 'absent'
                ? `${id}:${request.target.id}:absent`
                : result.version
                  ? `${id}:${request.target.id}@${result.version}`
                  : `${id}:${request.target.id}:present`,
          },
        ],
        kind: result.presence,
        target: request.target,
        ...(result.version ? { version: result.version } : {}),
      })
    },
  }
}

function createExecutableAdapter<Id extends 'binary' | 'script'>(
  id: Id,
  dependencies: CoreProviderObservationDependencies,
): ProviderAdapter & { readonly id: Id } {
  return {
    availability: async context => {
      if (context.signal.aborted) return cancelled(context.signal)
      return success({ executable: dependencies.platform === 'win32' ? 'powershell.exe' : 'sh' })
    },
    id,
    async observe(request) {
      const binaryName = request.target.binaryName
      if (!binaryName) {
        return {
          evidence: [{ kind: 'provider', value: `${id}:${request.target.id}:presence-unknown` }],
          kind: 'indeterminate',
          reason: `${id} candidate does not declare an executable presence probe`,
        }
      }
      const result = await safelyRun(
        [dependencies.platform === 'win32' ? 'where' : 'which', binaryName],
        request.context,
        dependencies,
      )
      if (!result) {
        return {
          kind: 'failed',
          reason: `${id} executable probe failed for ${request.target.id}`,
          retryable: true,
        }
      }
      return success({
        evidence: [{ kind: 'executable', value: binaryName }],
        kind: result.exitCode === 0 ? ('present' as const) : ('absent' as const),
        target: request.target,
      })
    },
  }
}

async function observeAvailability(
  executable: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<ProviderOutcome<{ readonly executable: string }>> {
  try {
    const result = await dependencies.runCommand([executable, '--version'], context)
    return result.exitCode === 0
      ? success({ executable })
      : { kind: 'unavailable', reason: `${executable} executable is unavailable` }
  } catch (error) {
    if (error instanceof CoreProcessInterruptionError) throw error
    return { kind: 'unavailable', reason: `${executable} executable is unavailable` }
  }
}

async function probeBun(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const result = await safelyRun(['bun', 'pm', '-g', 'ls'], context, dependencies)
  if (!result) return { presence: 'unknown' }
  if (!result.stdout.trim()) {
    if (result.stderr.includes('No package.json was found for directory')) return { presence: 'absent' }
    if (!result.stderr.includes('Lockfile not found')) return { presence: 'unknown' }
    try {
      const globalRoot =
        dependencies.env.BUN_INSTALL_GLOBAL_DIR ?? join(dependencies.homeDir(), '.bun', 'install', 'global')
      return {
        presence: classifyManifestPresence(await dependencies.readFile(join(globalRoot, 'package.json')), packageName),
      }
    } catch {
      return { presence: 'unknown' }
    }
  }
  const version = parseBunVersion(result.stdout, packageName)
  if (version) return { presence: 'present', version }
  return result.stdout.split('\n').some(line => line.trim().split(/\s+/u).at(-1)?.startsWith(`${packageName}@`))
    ? { presence: 'present' }
    : { presence: 'absent' }
}

async function probeNpm(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const result = await safelyRun(['npm', 'list', '-g', packageName, '--depth=0', '--json'], context, dependencies)
  if (!result?.stdout.trim()) return { presence: 'unknown' }
  try {
    const data = JSON.parse(result.stdout) as {
      dependencies?: Record<string, { version?: unknown }>
      error?: unknown
    }
    if (!isPlainObject(data) || Object.hasOwn(data, 'error')) return { presence: 'unknown' }
    const installed = data.dependencies?.[packageName]
    if (!installed) return { presence: 'absent' }
    return typeof installed.version === 'string'
      ? { presence: 'present', version: installed.version }
      : { presence: 'present' }
  } catch {
    return { presence: 'unknown' }
  }
}

async function probeBrew(
  target: ProviderTarget,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const kind = target.kind === 'cask' ? '--cask' : '--formula'
  const result = await safelyRun(['brew', 'list', kind, '--versions', target.id], context, dependencies)
  if (!result) return { presence: 'unknown' }
  const version = result.stdout.trim().split(/\s+/u).at(-1)
  if (result.exitCode === 0) {
    return version && /^\d/u.test(version) ? { presence: 'present', version } : { presence: 'present' }
  }
  const missing = result.stderr.toLowerCase()
  return missing.includes('no such keg') || missing.includes('is not installed')
    ? { presence: 'absent' }
    : { presence: 'unknown' }
}

async function probeCargo(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const result = await safelyRun(['cargo', 'install', '--list'], context, dependencies)
  if (!result || result.exitCode !== 0) return { presence: 'unknown' }
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const version = result.stdout.match(new RegExp(`^${escaped}\\s+v([^:\\s]+):\\s*$`, 'mu'))?.[1]
  return version ? { presence: 'present', version } : { presence: 'absent' }
}

async function probeDeno(
  target: ProviderTarget,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  if (context.signal.aborted) throw new CoreProcessInterruptionError(abortReason(context.signal))
  const binaryName = target.binaryName?.trim() || target.id.trim().split('/').pop()?.replace(/@.*$/u, '')
  if (!binaryName) return { presence: 'unknown' }
  const root = dependencies.env.DENO_INSTALL_ROOT?.trim() || join(dependencies.homeDir(), '.deno')
  try {
    await dependencies.access(join(root, 'bin', binaryName))
    if (context.signal.aborted) throw new CoreProcessInterruptionError(abortReason(context.signal))
    return { presence: 'present' }
  } catch (error) {
    if (error instanceof CoreProcessInterruptionError) throw error
    if (isMissingFileError(error)) return { presence: 'absent' }
    return { presence: 'unknown' }
  }
}

async function probeMise(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const result = await safelyRun(['mise', 'ls', '--installed', '--json', packageName], context, dependencies)
  if (!result?.stdout.trim()) return { presence: 'unknown' }
  try {
    const data = JSON.parse(result.stdout) as unknown
    if (!isPlainObject(data)) return { presence: 'unknown' }
    const shortName = packageName.split(':').pop()?.split('/').pop()
    const key = Array.isArray(data[packageName])
      ? packageName
      : shortName && Array.isArray(data[shortName])
        ? shortName
        : undefined
    const entries = key ? data[key] : undefined
    if (!Array.isArray(entries) || entries.length === 0) return { presence: 'absent' }
    const version = entries.find(entry => isPlainObject(entry) && typeof entry.version === 'string')
    return isPlainObject(version) && typeof version.version === 'string'
      ? { presence: 'present', version: version.version }
      : { presence: 'present' }
  } catch {
    return { presence: 'unknown' }
  }
}

async function probePip(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const candidates = [['pip'], ['pip3'], ['python', '-m', 'pip'], ['python3', '-m', 'pip']]
  for (const candidate of candidates) {
    const available = await safelyRun([...candidate, '--version'], context, dependencies)
    if (!available || available.exitCode !== 0) continue
    const result = await safelyRun([...candidate, 'show', packageName], context, dependencies)
    if (!result) return { presence: 'unknown' }
    if (result.exitCode === 0) {
      const version = result.stdout
        .split(/\r?\n/u)
        .map(line => /^Version:\s*(.+)\s*$/iu.exec(line.trim())?.[1]?.trim())
        .find(Boolean)
      return version ? { presence: 'present', version } : { presence: 'present' }
    }
    const missing = result.stderr.toLowerCase()
    return missing.includes('package(s) not found') || missing.includes('not found')
      ? { presence: 'absent' }
      : { presence: 'unknown' }
  }
  return { presence: 'unknown' }
}

async function probeUv(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const result = await safelyRun(['uv', 'tool', 'list'], context, dependencies)
  if (!result?.stdout.trim()) return { presence: 'unknown' }
  const expected = normalizePythonName(packageName)
  let hasEntries = false
  for (const rawLine of result.stdout.split(/\r?\n/u)) {
    const match = /^(\S+)\s+v([^\s]+)/u.exec(rawLine.trim())
    if (!match) continue
    hasEntries = true
    if (normalizePythonName(match[1]!) === expected) return { presence: 'present', version: match[2] }
  }
  return hasEntries ? { presence: 'absent' } : { presence: 'unknown' }
}

async function probeWinget(
  packageName: string,
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<PackageProbe> {
  const result = await safelyRun(['winget', 'list', '--id', packageName, '-e'], context, dependencies)
  if (!result) return { presence: 'unknown' }
  if (result.exitCode === 0) {
    const normalized = packageName.toLowerCase()
    for (const rawLine of result.stdout.split(/\r?\n/u)) {
      const parts = rawLine
        .trim()
        .split(/\s{2,}|\t+/u)
        .map(part => part.trim())
        .filter(Boolean)
      const idIndex = parts.findIndex(part => part.toLowerCase() === normalized)
      if (idIndex >= 0)
        return parts[idIndex + 1] ? { presence: 'present', version: parts[idIndex + 1] } : { presence: 'present' }
    }
    return result.stdout.toLowerCase().includes(normalized) ? { presence: 'present' } : { presence: 'unknown' }
  }
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return [
    'no installed package found',
    'no package found matching input criteria',
    'no installed package matched',
  ].some(marker => output.includes(marker))
    ? { presence: 'absent' }
    : { presence: 'unknown' }
}

async function safelyRun(
  argv: readonly string[],
  context: ProviderOperationContext,
  dependencies: CoreProviderObservationDependencies,
): Promise<ReadOnlyCommandResult | undefined> {
  try {
    return await dependencies.runCommand(argv, context)
  } catch (error) {
    if (error instanceof CoreProcessInterruptionError) throw error
    return undefined
  }
}

function parseBunVersion(output: string, packageName: string): string | undefined {
  const marker = `${packageName}@`
  for (const line of output.split('\n')) {
    const token = line.trim().split(/\s+/u).at(-1)
    if (token?.startsWith(marker) && token.length > marker.length) return token.slice(marker.length)
  }
  return undefined
}

function classifyManifestPresence(text: string, packageName: string): PackagePresence {
  try {
    const manifest = JSON.parse(text) as unknown
    if (!isPlainObject(manifest)) return 'unknown'
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      if (!Object.hasOwn(manifest, field)) continue
      const entries = manifest[field]
      if (!isPlainObject(entries)) return 'unknown'
      if (Object.hasOwn(entries, packageName)) return 'present'
    }
    return 'absent'
  } catch {
    return 'unknown'
  }
}

function success<T>(value: T): ProviderOutcome<T> {
  return { kind: 'success', value }
}

function cancelled(signal: AbortSignal): ProviderOutcome<never> {
  const reason = abortReason(signal)
  return { kind: 'cancelled', ...(reason ? { reason } : {}) }
}

function normalizePythonName(value: string): string {
  return value.toLowerCase().replaceAll(/[-_.]+/gu, '-')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function abortReason(signal: AbortSignal): string | undefined {
  if (signal.reason === undefined) return undefined
  return signal.reason instanceof Error ? signal.reason.message : String(signal.reason)
}
