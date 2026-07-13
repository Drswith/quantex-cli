import type { ProviderOperationContext } from '../providers'
import process from 'node:process'
import {
  readProcessOutput,
  readProcessOutputWithContext,
  isProcessInterruptionError,
  spawnCommand,
  spawnWithQuantexStdio,
  waitForSpawnedCommand,
} from '../utils/child-process'

async function runUvToolCommand(
  action: 'install' | 'upgrade',
  packageName: string,
  packageInstallArgs: string[] = [],
): Promise<boolean> {
  try {
    return (
      (await waitForSpawnedCommand(
        spawnWithQuantexStdio(['uv', 'tool', action, packageName, ...packageInstallArgs]),
      )) === 0
    )
  } catch {
    return false
  }
}

export async function install(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runUvToolCommand('install', packageName, packageInstallArgs)
}

export async function update(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runUvToolCommand('upgrade', packageName, packageInstallArgs)
}

export async function updateMany(
  packages: Array<{ packageInstallArgs?: string[]; packageName: string }>,
): Promise<boolean> {
  for (const pkg of packages) {
    if (!(await update(pkg.packageName, pkg.packageInstallArgs))) return false
  }

  return true
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['uv', 'tool', 'uninstall', packageName]))) === 0
  } catch {
    return false
  }
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
