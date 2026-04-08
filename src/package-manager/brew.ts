import type { PackageTargetKind } from '../agents/types'

function getTargetArgs(packageTargetKind?: PackageTargetKind): string[] {
  return packageTargetKind === 'cask' ? ['--cask'] : []
}

async function runBrewCommand(action: 'install' | 'upgrade' | 'uninstall', packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  try {
    const proc = Bun.spawn(['brew', action, ...getTargetArgs(packageTargetKind), packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function install(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('install', packageName, packageTargetKind)
}

export async function update(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('upgrade', packageName, packageTargetKind)
}

export async function updateMany(packages: Array<{ packageName: string, packageTargetKind?: PackageTargetKind }>): Promise<boolean> {
  for (const pkg of packages) {
    if (!await update(pkg.packageName, pkg.packageTargetKind))
      return false
  }

  return true
}

export async function uninstall(packageName: string, packageTargetKind?: PackageTargetKind): Promise<boolean> {
  return runBrewCommand('uninstall', packageName, packageTargetKind)
}
