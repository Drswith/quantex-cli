import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
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
