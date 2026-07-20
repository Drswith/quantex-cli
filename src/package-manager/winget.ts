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

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['winget', 'list', '--id', packageName, '-e'], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const { exitCode, stderr, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)

    if (exitCode === 0) {
      const version = parseWingetInstalledVersion(stdout, packageName)
      if (version) return { presence: 'present', version }
      if (stdout.toLowerCase().includes(packageName.toLowerCase())) return { presence: 'present' }
      return { presence: 'unknown' }
    }

    if (isWingetPackageMissingMessage(stderr) || isWingetPackageMissingMessage(stdout)) {
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

export function parseWingetInstalledVersion(output: string, packageName: string): string | undefined {
  const normalizedId = packageName.toLowerCase()
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.toLowerCase().startsWith('name') || line.startsWith('-')) continue
    const parts = line
      .split(/\s{2,}|\t+/)
      .map(part => part.trim())
      .filter(Boolean)
    if (parts.length < 2) continue
    const idIndex = parts.findIndex(part => part.toLowerCase() === normalizedId)
    if (idIndex < 0) continue
    const version = parts[idIndex + 1]
    return version && version.length > 0 ? version : undefined
  }
  return undefined
}

function isWingetPackageMissingMessage(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    normalized.includes('no installed package found') ||
    normalized.includes('no package found matching input criteria') ||
    normalized.includes('no installed package matched')
  )
}
