import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
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
