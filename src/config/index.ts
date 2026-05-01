import type { SelfUpdateChannel } from '../self/types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { normalizeRegistryUrl } from '../utils/registry'
import { defaultConfig } from './default'

export type NpmBunUpdateStrategy = 'latest-major' | 'respect-semver'

export interface QuantexConfig {
  defaultPackageManager: 'bun' | 'npm'
  networkRetries: number
  networkTimeoutMs: number
  npmBunUpdateStrategy: NpmBunUpdateStrategy
  selfUpdateChannel: SelfUpdateChannel
  selfUpdateRegistry?: string
  versionCacheTtlHours: number
  [key: string]: unknown
}

export function getConfigDir(): string {
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), '.quantex')
}

export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json')
}

export async function loadConfig(): Promise<QuantexConfig> {
  const normalizedConfig = {
    ...defaultConfig,
    ...(await readUserConfig()),
  } as Record<string, unknown>

  return {
    ...normalizedConfig,
    defaultPackageManager: normalizedConfig.defaultPackageManager === 'npm' ? 'npm' : 'bun',
    networkRetries: normalizePositiveInteger(normalizedConfig.networkRetries, 2),
    networkTimeoutMs: normalizePositiveInteger(normalizedConfig.networkTimeoutMs, 10000),
    npmBunUpdateStrategy:
      normalizedConfig.npmBunUpdateStrategy === 'respect-semver' ? 'respect-semver' : 'latest-major',
    selfUpdateChannel: normalizedConfig.selfUpdateChannel === 'beta' ? 'beta' : 'stable',
    selfUpdateRegistry:
      typeof normalizedConfig.selfUpdateRegistry === 'string'
        ? normalizeRegistryUrl(normalizedConfig.selfUpdateRegistry)
        : undefined,
    versionCacheTtlHours: normalizePositiveInteger(normalizedConfig.versionCacheTtlHours, 6),
  } as QuantexConfig
}

export function isNpmBunUpdateStrategy(value: string): value is NpmBunUpdateStrategy {
  return value === 'latest-major' || value === 'respect-semver'
}

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await writeFile(getConfigFilePath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

async function readUserConfig(): Promise<Record<string, unknown>> {
  try {
    const contents = await readFile(getConfigFilePath(), 'utf8')
    const parsed = JSON.parse(contents) as unknown
    return isPlainObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }

  return fallback
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
