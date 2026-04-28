import type { QuantexConfig } from '../config'
import type { SelfInstallSource } from './types'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { OFFICIAL_NPM_REGISTRY, normalizeRegistryUrl } from '../utils/registry'

export interface ManagedSelfUpdateRegistryResolution {
  isOverride: boolean
  registry: string
  source: 'bun-env' | 'bunfig' | 'npm-env' | 'npmrc' | 'quantex-config' | 'quantex-env' | 'fallback'
}

export async function resolveManagedSelfUpdateRegistry(
  installSource: SelfInstallSource,
  config: QuantexConfig,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): Promise<ManagedSelfUpdateRegistryResolution | undefined> {
  if (installSource !== 'bun' && installSource !== 'npm') return undefined

  const envOverride = normalizeRegistryUrl(env.QTX_SELF_UPDATE_REGISTRY)
  if (envOverride) return { isOverride: true, registry: envOverride, source: 'quantex-env' }

  if (config.selfUpdateRegistry) {
    return {
      isOverride: true,
      registry: config.selfUpdateRegistry,
      source: 'quantex-config',
    }
  }

  const packageManagerRegistry = await resolvePackageManagerRegistry(installSource, env, cwd)
  if (packageManagerRegistry) return packageManagerRegistry

  return {
    isOverride: false,
    registry: OFFICIAL_NPM_REGISTRY,
    source: 'fallback',
  }
}

async function resolvePackageManagerRegistry(
  installSource: Extract<SelfInstallSource, 'bun' | 'npm'>,
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<ManagedSelfUpdateRegistryResolution | undefined> {
  if (installSource === 'bun') {
    const envRegistry = readFirstRegistryFromEnv(env, [
      'BUN_CONFIG_REGISTRY',
      'NPM_CONFIG_REGISTRY',
      'npm_config_registry',
    ])
    if (envRegistry) return { isOverride: false, registry: envRegistry, source: 'bun-env' }

    const bunfigRegistry = await readRegistryFromBunfig(cwd, env)
    if (bunfigRegistry) return { isOverride: false, registry: bunfigRegistry, source: 'bunfig' }
  }

  const npmEnvRegistry = readFirstRegistryFromEnv(env, ['NPM_CONFIG_REGISTRY', 'npm_config_registry'])
  if (npmEnvRegistry) return { isOverride: false, registry: npmEnvRegistry, source: 'npm-env' }

  const npmrcRegistry = await readRegistryFromNpmrc(cwd, env)
  if (npmrcRegistry) return { isOverride: false, registry: npmrcRegistry, source: 'npmrc' }

  return undefined
}

function readFirstRegistryFromEnv(env: NodeJS.ProcessEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = normalizeRegistryUrl(env[key])
    if (value) return value
  }

  return undefined
}

async function readRegistryFromBunfig(cwd: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  const homeDir = resolveHomeDir(env)
  const xdgConfigDir = env.XDG_CONFIG_HOME
  const localBunfigPath = findNearestFile(cwd, 'bunfig.toml')
  const globalCandidates = [
    join(homeDir, '.bunfig.toml'),
    xdgConfigDir ? join(xdgConfigDir, '.bunfig.toml') : undefined,
  ]

  if (localBunfigPath) {
    const localRegistry = await parseBunfigRegistry(localBunfigPath)
    if (localRegistry) return localRegistry
  }

  for (const candidate of globalCandidates) {
    if (!candidate || !existsSync(candidate)) continue
    const registry = await parseBunfigRegistry(candidate)
    if (registry) return registry
  }

  return undefined
}

async function parseBunfigRegistry(path: string): Promise<string | undefined> {
  try {
    const parsed = Bun.TOML.parse(await readFile(path, 'utf8')) as {
      install?: {
        registry?: string | { url?: string }
      }
    }
    const registryValue = parsed.install?.registry
    if (typeof registryValue === 'string') return normalizeRegistryUrl(registryValue)
    return normalizeRegistryUrl(registryValue?.url)
  } catch {
    return undefined
  }
}

async function readRegistryFromNpmrc(cwd: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  const homeDir = resolveHomeDir(env)
  const localNpmrcPath = findNearestFile(cwd, '.npmrc')
  const userNpmrcPath = join(homeDir, '.npmrc')

  if (localNpmrcPath) {
    const localRegistry = await parseNpmrcRegistry(localNpmrcPath)
    if (localRegistry) return localRegistry
  }

  if (existsSync(userNpmrcPath)) return parseNpmrcRegistry(userNpmrcPath)

  return undefined
}

async function parseNpmrcRegistry(path: string): Promise<string | undefined> {
  try {
    const content = await readFile(path, 'utf8')
    const lines = content.split('\n').map(line => line.trim())

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]
      if (!line || line.startsWith('#') || line.startsWith(';')) continue

      const match = line.match(/^registry\s*=\s*(.+)$/)
      if (!match?.[1]) continue

      const registry = normalizeRegistryUrl(match[1])
      if (registry) return registry
    }
  } catch {}

  return undefined
}

function findNearestFile(startDir: string, fileName: string): string | undefined {
  let currentDir = startDir

  while (true) {
    const candidate = join(currentDir, fileName)
    if (existsSync(candidate)) return candidate

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) return undefined
    currentDir = parentDir
  }
}

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
  return env.HOME || env.USERPROFILE || homedir()
}
