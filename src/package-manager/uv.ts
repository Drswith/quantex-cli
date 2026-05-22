import { readProcessOutput, spawnCommand, spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

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

export async function getInstalledVersion(packageName: string): Promise<string | undefined> {
  try {
    const proc = spawnCommand(['uv', 'tool', 'list'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const { exitCode, stdout } = await readProcessOutput(proc)

    if (exitCode !== 0) return undefined

    return parseToolListVersion(stdout, packageName)
  } catch {
    return undefined
  }
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
