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

async function runUvToolCommand(
  action: 'install' | 'upgrade',
  packageName: string,
  packageInstallArgs: string[] = [],
): Promise<boolean> {
  return projectLegacyPackageMutation(context =>
    runUvToolCommandOutcome(action, packageName, packageInstallArgs, context),
  )
}

function runUvToolCommandOutcome(
  action: 'install' | 'upgrade',
  packageName: string,
  packageInstallArgs: string[],
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(
    ['uv', 'tool', action, packageName, ...packageInstallArgs],
    context,
    `uv ${action} failed`,
  )
}

export async function install(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runUvToolCommand('install', packageName, packageInstallArgs)
}

export function installOutcome(
  packageName: string,
  packageInstallArgs: string[] | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runUvToolCommandOutcome('install', packageName, packageInstallArgs ?? [], context)
}

export async function update(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runUvToolCommand('upgrade', packageName, packageInstallArgs)
}

export function updateOutcome(
  packageName: string,
  packageInstallArgs: string[] | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runUvToolCommandOutcome('upgrade', packageName, packageInstallArgs ?? [], context)
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
    packages.map(pkg => ['uv', 'tool', 'upgrade', pkg.packageName, ...(pkg.packageInstallArgs ?? [])]),
    context,
    'uv update failed',
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => uninstallOutcome(packageName, context))
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(['uv', 'tool', 'uninstall', packageName], context, 'uv uninstall failed')
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['uv', 'tool', 'list'], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const { stdout } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    if (!stdout.trim()) return { presence: 'unknown' }

    const version = parseToolListVersion(stdout, packageName)
    if (version) return { presence: 'present', version }
    if (!hasUvToolEntries(stdout)) return { presence: 'unknown' }

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

function hasUvToolEntries(output: string): boolean {
  return output.split(/\r?\n/).some(line => /^\S+\s+v[^\s]+/.test(line.trim()))
}

export function parseToolListVersion(output: string, packageName: string): string | undefined {
  const expectedName = normalizePythonPackageName(packageName)

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = /^(\S+)\s+v([^\s]+)/.exec(line)
    if (!match) continue

    const [, candidateName, version] = match
    if (normalizePythonPackageName(candidateName) === expectedName) return version
  }

  return undefined
}

function normalizePythonPackageName(packageName: string): string {
  return packageName.toLowerCase().replaceAll(/[-_.]+/g, '-')
}
