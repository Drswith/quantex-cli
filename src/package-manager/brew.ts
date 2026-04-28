import type { PackageTargetKind } from '../agents/types'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

function getTargetArgs(packageTargetKind?: PackageTargetKind): string[] {
  return packageTargetKind === 'cask' ? ['--cask'] : []
}

async function runBrewCommand(
  action: 'install' | 'upgrade' | 'uninstall',
  packageName: string,
  packageTargetKind?: PackageTargetKind,
): Promise<boolean> {
  try {
    return (
      (await waitForSpawnedCommand(
        spawnWithQuantexStdio(['brew', action, ...getTargetArgs(packageTargetKind), packageName]),
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
