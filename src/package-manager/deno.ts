import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

async function runDenoInstallCommand(
  packageName: string,
  packageInstallArgs: string[] = [],
  options: {
    force?: boolean
  } = {},
): Promise<boolean> {
  const args = ['deno', 'install', '--global']
  if (options.force) args.push('--force')
  args.push(...packageInstallArgs, packageName)

  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(args))) === 0
  } catch {
    return false
  }
}

export async function install(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runDenoInstallCommand(packageName, packageInstallArgs)
}

export async function update(packageName: string, packageInstallArgs?: string[]): Promise<boolean> {
  return runDenoInstallCommand(packageName, packageInstallArgs, {
    force: true,
  })
}

export async function updateMany(
  packages: Array<{ packageInstallArgs?: string[]; packageName: string }>,
): Promise<boolean> {
  for (const pkg of packages) {
    if (!(await update(pkg.packageName, pkg.packageInstallArgs))) return false
  }

  return true
}

export async function uninstall(binaryName: string): Promise<boolean> {
  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['deno', 'uninstall', '--global', binaryName]))) === 0
  } catch {
    return false
  }
}
