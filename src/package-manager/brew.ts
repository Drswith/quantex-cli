import type { PackageTargetKind } from '../agents/types'
import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './context-mutation'
import process from 'node:process'
import {
  isProcessInterruptionError,
  readProcessOutput,
  readProcessOutputWithContext,
  spawnCommand,
} from '../utils/child-process'
import { runPackageMutationOutcome, runPackageMutationSequence } from './context-mutation'
import { projectLegacyPackageMutation } from './mutation-outcome'

function getTargetArgs(packageTargetKind?: PackageTargetKind): string[] {
  return packageTargetKind === 'cask' ? ['--cask'] : []
}

function getListTargetArgs(packageTargetKind?: PackageTargetKind): string[] {
  return packageTargetKind === 'cask' ? ['--cask'] : ['--formula']
}

async function runBrewCommand(
  action: 'install' | 'upgrade' | 'uninstall',
  packageName: string,
  packageTargetKind?: PackageTargetKind,
): Promise<boolean> {
  return projectLegacyPackageMutation(context => runBrewCommandOutcome(action, packageName, packageTargetKind, context))
}

function runBrewCommandOutcome(
  action: 'install' | 'upgrade' | 'uninstall',
  packageName: string,
  packageTargetKind: PackageTargetKind | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(
    ['brew', action, ...getTargetArgs(packageTargetKind), packageName],
    context,
    `brew ${action} failed`,
  )
}

export async function install(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('install', packageName, packageTargetKind)
}

export function installOutcome(
  packageName: string,
  packageTargetKind: PackageTargetKind | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runBrewCommandOutcome('install', packageName, packageTargetKind, context)
}

export async function update(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('upgrade', packageName, packageTargetKind)
}

export function updateOutcome(
  packageName: string,
  packageTargetKind: PackageTargetKind | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runBrewCommandOutcome('upgrade', packageName, packageTargetKind, context)
}

export async function updateMany(
  packages: Array<{ packageName: string; packageTargetKind?: PackageTargetKind }>,
): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packages, context))
}

export function updateManyOutcome(
  packages: Array<{ packageName: string; packageTargetKind?: PackageTargetKind }>,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationSequence(
    packages.map(pkg => ['brew', 'upgrade', ...getTargetArgs(pkg.packageTargetKind), pkg.packageName]),
    context,
    'brew update failed',
  )
}

export async function uninstall(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('uninstall', packageName, packageTargetKind)
}

export function uninstallOutcome(
  packageName: string,
  packageTargetKind: PackageTargetKind | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runBrewCommandOutcome('uninstall', packageName, packageTargetKind, context)
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['brew', 'list', ...getListTargetArgs(packageTargetKind), '--versions', packageName], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const { exitCode, stderr, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    const version = parseBrewInstalledVersion(stdout)

    if (exitCode === 0) {
      return version ? { presence: 'present', version } : { presence: 'present' }
    }

    if (exitCode === 1 && isBrewPackageMissingMessage(stderr)) {
      return { presence: 'absent' }
    }

    return { presence: 'unknown' }
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
  context?: ProviderOperationContext,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(packageName, packageTargetKind, context)).presence
}

export async function getInstalledVersion(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return (await readPackagePresence(packageName, packageTargetKind, context)).version
}

export function parseBrewInstalledVersion(output: string): string | undefined {
  const line = output
    .trim()
    .split('\n')
    .find(entry => entry.trim())
  if (!line) return undefined

  const parts = line.trim().split(/\s+/)
  if (parts.length < 2) return undefined

  const version = parts.at(-1)
  return version && /^\d/.test(version) ? version : undefined
}

function isBrewPackageMissingMessage(stderr: string): boolean {
  const normalized = stderr.toLowerCase()
  return normalized.includes('no such keg') || normalized.includes('is not installed')
}
