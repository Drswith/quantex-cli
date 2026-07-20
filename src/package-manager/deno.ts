import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
import { access, constants } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { isProcessInterruptionError } from '../utils/child-process'
import { projectLegacyPackageMutation, runPackageMutationOutcome, runPackageMutationSequence } from './mutation-outcome'

async function runDenoInstallCommand(
  packageName: string,
  packageInstallArgs: string[] = [],
  options: {
    force?: boolean
  } = {},
): Promise<boolean> {
  return projectLegacyPackageMutation(context =>
    runDenoInstallCommandOutcome(packageName, packageInstallArgs, options, context),
  )
}

function runDenoInstallCommandOutcome(
  packageName: string,
  packageInstallArgs: string[],
  options: { force?: boolean },
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const args = ['deno', 'install', '--global']
  if (options.force) args.push('--force')
  args.push(...packageInstallArgs, packageName)
  return runPackageMutationOutcome(args, context, `deno ${options.force ? 'update' : 'install'} failed`)
}

export async function install(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runDenoInstallCommand(packageName, packageInstallArgs)
}

export function installOutcome(
  packageName: string,
  packageInstallArgs: string[] | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runDenoInstallCommandOutcome(packageName, packageInstallArgs ?? [], {}, context)
}

export async function update(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runDenoInstallCommand(packageName, packageInstallArgs, {
    force: true,
  })
}

export function updateOutcome(
  packageName: string,
  packageInstallArgs: string[] | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runDenoInstallCommandOutcome(packageName, packageInstallArgs ?? [], { force: true }, context)
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
    packages.map(pkg => ['deno', 'install', '--global', '--force', ...(pkg.packageInstallArgs ?? []), pkg.packageName]),
    context,
    'deno update failed',
  )
}

export async function uninstall(binaryName: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => uninstallOutcome(binaryName, context))
}

export function uninstallOutcome(
  binaryName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(['deno', 'uninstall', '--global', binaryName], context, 'deno uninstall failed')
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  binaryName: string,
  _context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  if (!binaryName.trim()) return { presence: 'unknown' }

  try {
    const binaryPath = join(resolveDenoInstallRoot(), 'bin', binaryName)
    await access(binaryPath, constants.F_OK)
    return { presence: 'present' }
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    if (isNodeErrnoException(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return { presence: 'absent' }
    }
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  binaryName: string,
  context?: ProviderOperationContext,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(binaryName, context)).presence
}

export async function getInstalledVersion(
  binaryName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return (await readPackagePresence(binaryName, context)).version
}

export function inferDenoBinaryName(packageName: string, binaryName?: string): string {
  if (binaryName?.trim()) return binaryName.trim()
  const stem = packageName.trim().split('/').pop()?.replace(/@.*$/, '')
  return stem && stem.length > 0 ? stem : packageName.trim()
}

export function resolveDenoInstallRoot(): string {
  const configured = process.env.DENO_INSTALL_ROOT?.trim()
  return configured && configured.length > 0 ? configured : join(homedir(), '.deno')
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}
