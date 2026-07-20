import type { ProviderOperationContext, ProviderOutcome } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
import process from 'node:process'
import {
  readProcessOutput,
  readProcessOutputWithContext,
  isProcessInterruptionError,
  spawnCommand,
} from '../utils/child-process'
import { projectLegacyPackageMutation, runPackageMutationOutcome, runPackageMutationSequence } from './mutation-outcome'

let resolvedPipCommand: string[] | null = null

async function runPipCommand(args: string[]): Promise<boolean> {
  return projectLegacyPackageMutation(context => runPipCommandOutcome(args, context))
}

async function resolvePipCommandOutcome(
  context: ProviderOperationContext,
): Promise<ProviderOutcome<readonly string[]>> {
  if (resolvedPipCommand) return { kind: 'success', value: resolvedPipCommand }

  const candidates = [['pip'], ['pip3'], ['python', '-m', 'pip'], ['python3', '-m', 'pip']]
  for (const cmd of candidates) {
    try {
      const proc = spawnCommand([...cmd, '--version'], {
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const { exitCode } = await readProcessOutputWithContext(proc, context)
      if (exitCode === 0) {
        resolvedPipCommand = cmd
        return { kind: 'success', value: cmd }
      }
    } catch (error) {
      if (isProcessInterruptionError(error)) {
        return error.kind === 'timed-out'
          ? { kind: 'timed-out', timeoutMs: error.timeoutMs ?? context.timeoutMs ?? 0 }
          : { kind: 'cancelled', ...(error.reason ? { reason: error.reason } : {}) }
      }
    }
  }

  resolvedPipCommand = ['pip']
  return { kind: 'success', value: resolvedPipCommand }
}

async function runPipCommandOutcome(
  args: string[],
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const resolved = await resolvePipCommandOutcome(context)
  if (resolved.kind !== 'success') return resolved
  return runPackageMutationOutcome([...resolved.value, ...args], context, 'pip command failed')
}

export async function install(packageName: string): Promise<boolean> {
  return runPipCommand(['install', packageName])
}

export function installOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPipCommandOutcome(['install', packageName], context)
}

export async function update(packageName: string): Promise<boolean> {
  return runPipCommand(['install', '--upgrade', packageName])
}

export function updateOutcome(packageName: string, context: ProviderOperationContext): Promise<PackageMutationOutcome> {
  return runPipCommandOutcome(['install', '--upgrade', packageName], context)
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packages, context))
}

export async function updateManyOutcome(
  packages: Array<{ packageName: string }>,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  if (packages.length === 0) return { kind: 'success', value: undefined }
  const resolved = await resolvePipCommandOutcome(context)
  if (resolved.kind !== 'success') return resolved
  return runPackageMutationSequence(
    packages.map(pkg => [...resolved.value, 'install', '--upgrade', pkg.packageName]),
    context,
    'pip update failed',
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return runPipCommand(['uninstall', '-y', packageName])
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPipCommandOutcome(['uninstall', '-y', packageName], context)
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  const resolveContext =
    context ??
    ({
      signal: new AbortController().signal,
      timeoutMs: 5_000,
    } satisfies ProviderOperationContext)

  try {
    const resolved = await resolvePipCommandOutcome(resolveContext)
    if (resolved.kind !== 'success') return { presence: 'unknown' }

    const proc = spawnCommand([...resolved.value, 'show', packageName], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const { exitCode, stderr, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    if (exitCode === 0) {
      const version = parsePipInstalledVersion(stdout)
      return version ? { presence: 'present', version } : { presence: 'present' }
    }
    if (exitCode === 1 && isPipPackageMissingMessage(stderr)) return { presence: 'absent' }
    return { presence: 'unknown' }
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(packageName, context)).presence
}

export async function getInstalledVersion(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return (await readPackagePresence(packageName, context)).version
}

export function parsePipInstalledVersion(output: string): string | undefined {
  for (const rawLine of output.split(/\r?\n/)) {
    const match = /^Version:\s*(.+)\s*$/i.exec(rawLine.trim())
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

function isPipPackageMissingMessage(stderr: string): boolean {
  const normalized = stderr.toLowerCase()
  return normalized.includes('package(s) not found') || normalized.includes('not found')
}
