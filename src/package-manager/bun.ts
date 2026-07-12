import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
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

export type PackagePresenceProbe = 'present' | 'absent' | 'unknown'

export interface BunPresenceProbeDependencies {
  readonly readGlobalManifest: () => Promise<string>
}

const defaultPresenceDependencies: BunPresenceProbeDependencies = {
  readGlobalManifest: () =>
    readFile(
      join(process.env.BUN_INSTALL_GLOBAL_DIR ?? join(homedir(), '.bun', 'install', 'global'), 'package.json'),
      'utf8',
    ),
}

async function readPackagePresence(
  packageName: string,
  dependencies: BunPresenceProbeDependencies = defaultPresenceDependencies,
): Promise<{ presence: PackagePresenceProbe; version?: string }> {
  try {
    const proc = spawnCommand(['bun', 'pm', '-g', 'ls'], {
      stdio: createPipedStdio(),
    })
    const { stderr, stdout } = await readProcessOutput(proc)
    if (!stdout.trim()) {
      if (stderr.includes('No package.json was found for directory')) return { presence: 'absent' }
      if (stderr.includes('Lockfile not found')) {
        try {
          return { presence: classifyGlobalManifestPresence(await dependencies.readGlobalManifest(), packageName) }
        } catch {
          return { presence: 'unknown' }
        }
      }
      return { presence: 'unknown' }
    }

    const version = parseGlobalPackageVersion(stdout, packageName)
    if (version) return { presence: 'present', version }
    if (hasGlobalPackageEntry(stdout, packageName)) return { presence: 'present' }

    return { presence: 'absent' }
  } catch {
    return { presence: 'unknown' }
  }
}

export async function probePackagePresence(
  packageName: string,
  dependencies: BunPresenceProbeDependencies = defaultPresenceDependencies,
): Promise<PackagePresenceProbe> {
  return (await readPackagePresence(packageName, dependencies)).presence
}

export async function getInstalledVersion(packageName: string): Promise<string | undefined> {
  return (await readPackagePresence(packageName)).version
}

function hasGlobalPackageEntry(output: string, packageName: string): boolean {
  const marker = `${packageName}@`

  return output.split('\n').some(line => line.trim().split(/\s+/).at(-1)?.startsWith(marker))
}

function classifyGlobalManifestPresence(manifestText: string, packageName: string): PackagePresenceProbe {
  const manifest = JSON.parse(manifestText) as unknown
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) return 'unknown'

  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    if (!Object.hasOwn(manifest, field)) continue
    const dependencies = (manifest as Record<string, unknown>)[field]
    if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) return 'unknown'
    if (Object.hasOwn(dependencies, packageName)) return 'present'
  }

  return 'absent'
}

export function parseGlobalPackageVersion(output: string, packageName: string): string | undefined {
  const marker = `${packageName}@`

  for (const line of output.split('\n')) {
    const packageToken = line.trim().split(/\s+/).at(-1)
    if (!packageToken?.startsWith(marker)) continue

    const version = packageToken.slice(marker.length)
    if (version) return version
  }

  return undefined
}

async function runGlobalBunCommandWithTrust(command: string[], packageNames: string[]): Promise<boolean> {
  const exitCode = await waitForSpawnedCommand(spawnWithQuantexStdio(command))

  if (exitCode !== 0) return false

  const trusted = await trustBlockedGlobalPackages(packageNames)
  if (!trusted && command[1] === 'add') {
    await rollbackGlobalBunPackages(packageNames)
  }

  return trusted
}

async function rollbackGlobalBunPackages(packageNames: string[]): Promise<void> {
  for (const packageName of new Set(packageNames)) {
    try {
      await waitForSpawnedCommand(spawnWithQuantexStdio(['bun', 'remove', '-g', packageName]))
    } catch {
      // Best-effort rollback so fallback install methods do not inherit duplicate Bun globals.
    }
  }
}

async function trustBlockedGlobalPackages(packageNames: string[]): Promise<boolean> {
  const requestedPackages = [...new Set(packageNames)]
  if (requestedPackages.length === 0) return true

  const output = await readGlobalUntrustedPackages()
  if (output === undefined) return false

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

export function parseUntrustedPackages(output: string): Set<string> {
  const packages = new Set<string>()

  for (const line of output.split('\n')) {
    const normalizedLine = line.replaceAll('\\', '/')
    const match = normalizedLine.match(/^\.\/node_modules\/(.+?) @/)
    if (match?.[1]) packages.add(match[1])
  }

  return packages
}

function createPipedStdio(): ['ignore', 'pipe', 'pipe'] {
  return ['ignore', 'pipe', 'pipe']
}
