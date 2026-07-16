import type { PackageTargetKind } from '../agents/types'
import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
import { projectLegacyPackageMutation, runPackageMutationOutcome, runPackageMutationSequence } from './mutation-outcome'

function getTargetArgs(packageTargetKind?: PackageTargetKind): string[] {
  return packageTargetKind === 'cask' ? ['--cask'] : []
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
