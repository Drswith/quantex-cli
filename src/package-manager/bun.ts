import { readProcessOutput, spawnCommand, spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'
import { normalizeRegistryUrl } from '../utils/registry'

export type RegistryUpdateStrategy = 'latest-major' | 'respect-semver'

export async function install(packageName: string, distTag?: string, registry?: string): Promise<boolean> {
  try {
    const targetPackage = distTag ? `${packageName}@${distTag}` : packageName
    const resolvedRegistry = normalizeRegistryUrl(registry)
    return await runGlobalBunCommandWithTrust(
      ['bun', 'add', '-g', ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []), targetPackage],
      [packageName],
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
    const targetPackage = distTag === 'latest' ? packageName : `${packageName}@${distTag}`
    const resolvedRegistry = normalizeRegistryUrl(registry)
    return await runGlobalBunCommandWithTrust(
      [
        'bun',
        'update',
        '-g',
        ...(strategy === 'latest-major' ? ['--latest'] : []),
        ...(resolvedRegistry ? ['--registry', resolvedRegistry] : []),
        targetPackage,
      ],
      [packageName],
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
    return await runGlobalBunCommandWithTrust(
      ['bun', 'update', '-g', ...(strategy === 'latest-major' ? ['--latest'] : []), ...packageNames],
      packageNames,
    )
  } catch {
    return false
  }
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['bun', 'remove', '-g', packageName]))) === 0
  } catch {
    return false
  }
}

async function runGlobalBunCommandWithTrust(command: string[], packageNames: string[]): Promise<boolean> {
  const exitCode = await waitForSpawnedCommand(spawnWithQuantexStdio(command))

  if (exitCode !== 0) return false

  return trustBlockedGlobalPackages(packageNames)
}

async function trustBlockedGlobalPackages(packageNames: string[]): Promise<boolean> {
  const requestedPackages = [...new Set(packageNames)]
  if (requestedPackages.length === 0) return true

  const output = await readGlobalUntrustedPackages()
  if (!output) return true

  const untrustedPackages = parseUntrustedPackages(output)
  const blockedPackages = requestedPackages.filter(packageName => untrustedPackages.has(packageName))

  if (blockedPackages.length === 0) return true

  return (await waitForSpawnedCommand(spawnWithQuantexStdio(['bun', 'pm', '-g', 'trust', ...blockedPackages]))) === 0
}

async function readGlobalUntrustedPackages(): Promise<string | undefined> {
  try {
    const proc = spawnCommand(['bun', 'pm', '-g', 'untrusted'], {
      stdio: createPipedStdio(),
    })
    const { exitCode, stdout } = await readProcessOutput(proc)

    if (exitCode !== 0) return undefined

    return stdout
  } catch {
    return undefined
  }
}

function parseUntrustedPackages(output: string): Set<string> {
  const packages = new Set<string>()

  for (const line of output.split('\n')) {
    const match = line.match(/^\.\/node_modules\/(.+?) @/)
    if (match?.[1]) packages.add(match[1])
  }

  return packages
}

function createPipedStdio(): ['ignore', 'pipe', 'ignore'] {
  return ['ignore', 'pipe', 'ignore']
}
