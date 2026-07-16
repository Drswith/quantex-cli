import type { ProviderOperationContext } from '../providers'
import type { PackageMutationOutcome } from './mutation-outcome'
import { projectLegacyPackageMutation, runPackageMutationOutcome, runPackageMutationSequence } from './mutation-outcome'

async function runWingetCommand(action: 'install' | 'upgrade' | 'uninstall', packageName: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => runWingetCommandOutcome(action, packageName, context))
}

function runWingetCommandOutcome(
  action: 'install' | 'upgrade' | 'uninstall',
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(['winget', action, '--id', packageName, '-e'], context, `winget ${action} failed`)
}

export async function install(packageName: string): Promise<boolean> {
  return runWingetCommand('install', packageName)
}

export function installOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runWingetCommandOutcome('install', packageName, context)
}

export async function update(packageName: string): Promise<boolean> {
  return runWingetCommand('upgrade', packageName)
}

export function updateOutcome(packageName: string, context: ProviderOperationContext): Promise<PackageMutationOutcome> {
  return runWingetCommandOutcome('upgrade', packageName, context)
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packages, context))
}

export function updateManyOutcome(
  packages: Array<{ packageName: string }>,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationSequence(
    packages.map(pkg => ['winget', 'upgrade', '--id', pkg.packageName, '-e']),
    context,
    'winget update failed',
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return runWingetCommand('uninstall', packageName)
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runWingetCommandOutcome('uninstall', packageName, context)
}
