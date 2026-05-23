import { readProcessOutput, spawnCommand, spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'

async function runMiseUseCommand(packageName: string, force = false): Promise<boolean> {
  try {
    const args = ['mise', 'use', '--global', ...(force ? ['--force'] : []), packageName]
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(args))) === 0
  } catch {
    return false
  }
}

export async function install(packageName: string): Promise<boolean> {
  return runMiseUseCommand(packageName)
}

export async function update(packageName: string): Promise<boolean> {
  return runMiseUseCommand(packageName, true)
}

export async function updateMany(packages: Array<{ packageName: string }>): Promise<boolean> {
  for (const pkg of packages) {
    if (!(await update(pkg.packageName))) return false
  }

  return true
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['mise', 'unuse', '--global', packageName]))) === 0
  } catch {
    return false
  }
}

export async function getInstalledVersion(packageName: string): Promise<string | undefined> {
  try {
    const proc = spawnCommand(['mise', 'ls', '--installed', '--json', packageName], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const { exitCode, stdout } = await readProcessOutput(proc)

    if (exitCode !== 0) return undefined

    return parseMiseInstalledVersion(stdout, packageName)
  } catch {
    return undefined
  }
}

export function parseMiseInstalledVersion(output: string, packageName: string): string | undefined {
  try {
    const parsed = JSON.parse(output) as unknown
    if (!isPlainObject(parsed)) return undefined

    const key = findMiseToolKey(parsed, packageName)
    const entries = key ? parsed[key] : undefined
    if (!Array.isArray(entries)) return undefined

    for (const entry of entries) {
      if (isPlainObject(entry) && typeof entry.version === 'string' && entry.version.length > 0) {
        return entry.version
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

function findMiseToolKey(data: Record<string, unknown>, packageName: string): string | undefined {
  if (Array.isArray(data[packageName])) return packageName

  const shortName = packageName.split(':').pop()?.split('/').pop()
  if (!shortName) return undefined

  return Object.keys(data).find(key => key === shortName && Array.isArray(data[key]))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
