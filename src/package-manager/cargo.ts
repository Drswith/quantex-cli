import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
import process from 'node:process'
import {
  isProcessInterruptionError,
  readProcessOutput,
  readProcessOutputWithContext,
  spawnCommand,
} from '../utils/child-process'
import { projectLegacyPackageMutation, runPackageMutationOutcome, runPackageMutationSequence } from './mutation-outcome'

async function runCargoCommand(
  action: 'install' | 'uninstall',
  packageName: string,
  packageInstallArgs: string[] = [],
): Promise<boolean> {
  return projectLegacyPackageMutation(context =>
    runCargoCommandOutcome(action, packageName, packageInstallArgs, context),
  )
}

function runCargoCommandOutcome(
  action: 'install' | 'uninstall',
  packageName: string,
  packageInstallArgs: string[],
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(
    ['cargo', action, packageName, ...packageInstallArgs],
    context,
    `cargo ${action} failed`,
  )
}

export async function install(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runCargoCommand('install', packageName, packageInstallArgs)
}

export function installOutcome(
  packageName: string,
  packageInstallArgs: string[] | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runCargoCommandOutcome('install', packageName, packageInstallArgs ?? [], context)
}

export async function update(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return install(packageName, ['--force', ...(packageInstallArgs ?? [])])
}

export function updateOutcome(
  packageName: string,
  packageInstallArgs: string[] | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return installOutcome(packageName, ['--force', ...(packageInstallArgs ?? [])], context)
}

export async function updateMany(
  packages: Array<{ packageInstallArgs?: string[]; packageName: string }>,
): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packages, context))
}

export function updateManyOutcome(
  packages: Array<{ packageInstallArgs?: string[]; packageName: string }>,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationSequence(
    packages.map(pkg => ['cargo', 'install', pkg.packageName, '--force', ...(pkg.packageInstallArgs ?? [])]),
    context,
    'cargo update failed',
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return runCargoCommand('uninstall', packageName)
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runCargoCommandOutcome('uninstall', packageName, [], context)
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['cargo', 'install', '--list'], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const { exitCode, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)

    if (exitCode !== 0) return { presence: 'unknown' }

    const version = parseCargoInstalledVersion(stdout, packageName)
    if (version) return { presence: 'present', version }
    if (hasCargoPackageEntry(stdout, packageName)) return { presence: 'present' }
    return { presence: 'absent' }
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

export function parseCargoInstalledVersion(output: string, packageName: string): string | undefined {
  const match = findCargoPackageHeader(output, packageName)
  if (!match) return undefined
  const version = match[1]
  return version && /^\d/.test(version) ? version : undefined
}

function hasCargoPackageEntry(output: string, packageName: string): boolean {
  return findCargoPackageHeader(output, packageName) !== undefined
}

function findCargoPackageHeader(output: string, packageName: string): RegExpMatchArray | undefined {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}\\s+v([^:\\s]+):\\s*$`, 'm')
  return output.match(pattern) ?? undefined
}
