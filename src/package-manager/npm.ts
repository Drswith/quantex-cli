import type { RegistryUpdateStrategy } from './bun'
import { readProcessOutput, spawnCommand, spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'
import { normalizeRegistryUrl } from '../utils/registry'

export async function install(packageName: string, distTag?: string, registry?: string): Promise<boolean> {
  try {
    const targetPackage = distTag ? `${packageName}@${distTag}` : packageName
    const resolvedRegistry = normalizeRegistryUrl(registry)
    return (
      (await waitForSpawnedCommand(
        spawnWithQuantexStdio([
          'npm',
          'install',
          '-g',
          targetPackage,
          ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []),
        ]),
      )) === 0
    )
  } catch {
    return false
  }
}

export async function update(
  packageName: string,
  strategy: RegistryUpdateStrategy = 'latest-major',
  distTag: string = 'latest',
  registry?: string,
): Promise<boolean> {
  try {
    const resolvedRegistry = normalizeRegistryUrl(registry)
    return (
      (await waitForSpawnedCommand(
        spawnWithQuantexStdio(
          strategy === 'latest-major'
            ? [
                'npm',
                'install',
                '-g',
                `${packageName}@${distTag}`,
                ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []),
              ]
            : ['npm', 'update', '-g', packageName, ...(resolvedRegistry ? ['--registry', resolvedRegistry] : [])],
        ),
      )) === 0
    )
  } catch {
    return false
  }
}

export async function updateMany(
  packageNames: string[],
  strategy: RegistryUpdateStrategy = 'latest-major',
): Promise<boolean> {
  if (packageNames.length === 0) return true

  try {
    return (
      (await waitForSpawnedCommand(
        spawnWithQuantexStdio(
          strategy === 'latest-major'
            ? ['npm', 'install', '-g', ...packageNames.map(packageName => `${packageName}@latest`)]
            : ['npm', 'update', '-g', ...packageNames],
        ),
      )) === 0
    )
  } catch {
    return false
  }
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['npm', 'uninstall', '-g', packageName]))) === 0
  } catch {
    return false
  }
}

export async function getInstalledVersion(packageName: string): Promise<string | undefined> {
  try {
    const proc = spawnCommand(['npm', 'list', '-g', '--depth=0', '--json'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const { exitCode, stdout } = await readProcessOutput(proc)

    if (exitCode !== 0) return undefined

    return parseGlobalPackageVersion(stdout, packageName)
  } catch {
    return undefined
  }
}

export function parseGlobalPackageVersion(output: string, packageName: string): string | undefined {
  const data = JSON.parse(output) as {
    dependencies?: Record<string, { version?: unknown }>
  }
  const version = data.dependencies?.[packageName]?.version

  return typeof version === 'string' ? version : undefined
}
