import type { ProviderOperationContext } from '../providers'
import type { RegistryUpdateStrategy } from './bun'
import type { PackageMutationOutcome } from './context-mutation'
import {
  readProcessOutput,
  readProcessOutputWithContext,
  isProcessInterruptionError,
  spawnCommand,
} from '../utils/child-process'
import { normalizeRegistryUrl } from '../utils/registry'
import { runPackageMutationOutcome } from './context-mutation'
import { projectLegacyPackageMutation } from './mutation-outcome'

export async function install(packageName: string, distTag?: string, registry?: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => installOutcome(packageName, distTag, registry, context))
}

export function installOutcome(
  packageName: string,
  distTag: string | undefined,
  registry: string | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const targetPackage = distTag ? `${packageName}@${distTag}` : packageName
  const resolvedRegistry = normalizeRegistryUrl(registry)
  return runPackageMutationOutcome(
    ['npm', 'install', '-g', targetPackage, ...(resolvedRegistry ? ['--registry', resolvedRegistry] : [])],
    context,
    'npm install failed',
  )
}

export async function update(
  packageName: string,
  strategy: RegistryUpdateStrategy = 'latest-major',
  distTag: string = 'latest',
  registry?: string,
): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateOutcome(packageName, strategy, distTag, registry, context))
}

export function updateOutcome(
  packageName: string,
  strategy: RegistryUpdateStrategy,
  distTag: string,
  registry: string | undefined,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  const resolvedRegistry = normalizeRegistryUrl(registry)
  return runPackageMutationOutcome(
    strategy === 'latest-major'
      ? [
          'npm',
          'install',
          '-g',
          `${packageName}@${distTag}`,
          ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []),
        ]
      : ['npm', 'update', '-g', packageName, ...(resolvedRegistry ? ['--registry', resolvedRegistry] : [])],
    context,
    'npm update failed',
  )
}

export async function updateMany(
  packageNames: string[],
  strategy: RegistryUpdateStrategy = 'latest-major',
): Promise<boolean> {
  return projectLegacyPackageMutation(context => updateManyOutcome(packageNames, strategy, context))
}

export function updateManyOutcome(
  packageNames: string[],
  strategy: RegistryUpdateStrategy,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  if (packageNames.length === 0) return Promise.resolve({ kind: 'success', value: undefined })
  return runPackageMutationOutcome(
    strategy === 'latest-major'
      ? ['npm', 'install', '-g', ...packageNames.map(packageName => `${packageName}@latest`)]
      : ['npm', 'update', '-g', ...packageNames],
    context,
    'npm batch update failed',
  )
}

export async function uninstall(packageName: string): Promise<boolean> {
  return projectLegacyPackageMutation(context => uninstallOutcome(packageName, context))
}

export function uninstallOutcome(
  packageName: string,
  context: ProviderOperationContext,
): Promise<PackageMutationOutcome> {
  return runPackageMutationOutcome(['npm', 'uninstall', '-g', packageName], context, 'npm uninstall failed')
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
