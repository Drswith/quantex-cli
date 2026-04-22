import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

async function runWingetCommand(action: 'install' | 'upgrade' | 'uninstall', packageName: string): Promise<boolean> {
  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['winget', action, '--id', packageName, '-e']))) === 0
  }
  catch {
    return false
  }
}

export async function install(packageName: string): Promise<boolean> {
  return runWingetCommand('install', packageName)
}

export async function update(packageName: string): Promise<boolean> {
  return runWingetCommand('upgrade', packageName)
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  for (const pkg of packages) {
    if (!await update(pkg.packageName))
      return false
  }

  return true
}

export async function uninstall(packageName: string): Promise<boolean> {
  return runWingetCommand('uninstall', packageName)
}
