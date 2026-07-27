import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './context-mutation'
import process from 'node:process'
import {
  readProcessOutput,
  readProcessOutputWithContext,
  isProcessInterruptionError,
  spawnCommand,
} from '../utils/child-process'
import { runPackageMutationOutcome, runPackageMutationSequence } from './context-mutation'
import { projectLegacyPackageMutation } from './mutation-outcome'

async function runMiseUseCommand(packageName: string, force = false): Promise<boolean> {
  return projectLegacyPackageMutation(context => runMiseUseCommandOutcome(packageName, force, context))
}

function runMiseUseCommandOutcome(
  packageName: string,
  force: boolean,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(
    ['mise', 'use', '--global', ...(force ? ['--force'] : []), packageName],
    context,
    `mise ${force ? 'update' : 'install'} failed`,
  )
}

export async function install(packageName: string): Promise<boolean> {
  return runMiseUseCommand(packageName)
}

export function installOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runMiseUseCommandOutcome(packageName, false, context)
}

export async function update(packageName: string): Promise<boolean> {
  return runMiseUseCommand(packageName, true)
}

export function updateOutcome(packageName: string, context: ProviderOperationContext): Promise<PackageMutationOutcome> {
  return runMiseUseCommandOutcome(packageName, true, context)
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packages, context))
}

export function updateManyOutcome(
  packages: Array<{ packageName: string }>,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationSequence(
    packages.map(pkg => ['mise', 'use', '--global', '--force', pkg.packageName]),
    context,
    'mise update failed',
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => uninstallOutcome(packageName, context))
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(['mise', 'unuse', '--global', packageName], context, 'mise uninstall failed')
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['mise', 'ls', '--installed', '--json', packageName], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const { stdout } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    if (!stdout.trim()) return { presence: 'unknown' }

    try {
      const parsed = JSON.parse(stdout) as unknown
      if (!isPlainObject(parsed)) return { presence: 'unknown' }

      const key = findMiseToolKey(parsed, packageName)
      const entries = key ? parsed[key] : undefined
      if (!Array.isArray(entries) || entries.length === 0) return { presence: 'absent' }

      const version = parseMiseInstalledVersion(stdout, packageName)
      return version ? { presence: 'present', version } : { presence: 'present' }
    } catch {
      return { presence: 'unknown' }
    }
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

export function parseMiseInstalledVersion(output: string, packageName: string): string | undefined {
  try {
    const parsed = JSON.parse(output) as unknown
    if (!isPlainObject(parsed)) return undefined

    const key = findMiseToolKey(parsed, packageName)
    const entries = key ? parsed[key] : undefined
    if (!Array.isArray(entries)) return undefined

    for (const entry of entries) {
      if (isPlainObject(entry) && typeof entry.version === 'string' && entry.version.length > 0) {
        return entry.version
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

function findMiseToolKey(data: Record<string, unknown>, packageName: string): string | undefined {
  if (Array.isArray(data[packageName])) return packageName

  const shortName = packageName.split(':').pop()?.split('/').pop()
  if (!shortName) return undefined

  return Object.keys(data).find(key => key === shortName && Array.isArray(data[key]))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
