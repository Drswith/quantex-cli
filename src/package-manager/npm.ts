import type { RegistryUpdateStrategy } from './bun'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'
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
