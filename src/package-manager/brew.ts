import type { PackageTargetKind } from '../agents/types'
import { readProcessOutput, spawnCommand, spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

function getInstallTargetArgs(packageTargetKind?: PackageTargetKind): string[] {
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
  try {
    return (
      (await waitForSpawnedCommand(
        spawnWithQuantexStdio(['brew', action, ...getInstallTargetArgs(packageTargetKind), packageName]),
      )) === 0
    )
  } catch {
    return false
  }
}

export async function install(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('install', packageName, packageTargetKind)
}

export async function update(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('upgrade', packageName, packageTargetKind)
}

export async function updateMany(
  packages: Array<{ packageName: string; packageTargetKind?: PackageTargetKind }>,
): Promise<boolean> {
  for (const pkg of packages) {
    if (!(await update(pkg.packageName, pkg.packageTargetKind))) return false
  }

  return true
}

export async function uninstall(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('uninstall', packageName, packageTargetKind)
}

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

async function readPackagePresence(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['brew', 'list', ...getListTargetArgs(packageTargetKind), '--versions', packageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const { exitCode, stderr, stdout } = await readProcessOutput(proc)
    const version = parseBrewInstalledVersion(stdout)

    if (exitCode === 0) {
      return version ? { presence: 'present', version } : { presence: 'present' }
    }

    if (exitCode === 1 && isBrewPackageMissingMessage(stderr)) {
      return { presence: 'absent' }
    }

    return { presence: 'unknown' }
  } catch {
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(packageName, packageTargetKind)).presence
}

export async function getInstalledVersion(
  packageName: string,
  packageTargetKind?: PackageTargetKind,
): Promise<string | undefined> {
  return (await readPackagePresence(packageName, packageTargetKind)).version
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
