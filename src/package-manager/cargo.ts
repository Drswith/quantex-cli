import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

async function runCargoCommand(
  action: 'install' | 'uninstall',
  packageName: string,
  packageInstallArgs: string[] = [],
): Promise<boolean> {
  try {
    return (
      (await waitForSpawnedCommand(spawnWithQuantexStdio(['cargo', action, packageName, ...packageInstallArgs]))) === 0
    )
  } catch {
    return false
  }
}

export async function install(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runCargoCommand('install', packageName, packageInstallArgs)
}

export async function update(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return install(packageName, ['--force', ...(packageInstallArgs ?? [])])
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
  return runCargoCommand('uninstall', packageName)
}
