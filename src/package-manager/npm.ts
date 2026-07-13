import type { ProviderOperationContext } from '../providers'
import type { RegistryUpdateStrategy } from './bun'
import {
  readProcessOutput,
  readProcessOutputWithContext,
  isProcessInterruptionError,
  spawnCommand,
  spawnWithQuantexStdio,
  waitForSpawnedCommand,
} from '../utils/child-process'
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

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

interface PackagePresenceResult {
  presence: PackagePresenceProbe
  version?: string
}

async function readPackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<PackagePresenceResult> {
  try {
    const proc = spawnCommand(['npm', 'list', '-g', packageName, '--depth=0', '--json'], {
      detached: context !== undefined && process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const { stdout } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    if (!stdout.trim()) return { presence: 'unknown' }

    try {
      const data = JSON.parse(stdout) as {
        dependencies?: Record<string, { version?: unknown }>
        error?: unknown
      }
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.hasOwn(data, 'error')) {
        return { presence: 'unknown' }
      }

      if (data.dependencies && Object.hasOwn(data.dependencies, packageName)) {
        const version = parseGlobalPackageVersion(stdout, packageName)
        return version ? { presence: 'present', version } : { presence: 'present' }
      }

      return { presence: 'absent' }
    } catch {
      return { presence: 'unknown' }
    }
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(packageName, context)).presence
}

export async function getInstalledVersion(
  packageName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  return (await readPackagePresence(packageName, context)).version
}

export function parseGlobalPackageVersion(output: string, packageName: string): string | undefined {
  const data = JSON.parse(output) as {
    dependencies?: Record<string, { version?: unknown }>
  }
  const version = data.dependencies?.[packageName]?.version

  return typeof version === 'string' ? version : undefined
}
