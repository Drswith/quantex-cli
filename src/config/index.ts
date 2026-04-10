import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadConfig as c12LoadConfig } from 'c12'
import { defaultConfig } from './default'

export type NpmBunUpdateStrategy = 'latest-major' | 'respect-semver'

export interface QuantexConfig {
  defaultPackageManager: 'bun' | 'npm'
  npmBunUpdateStrategy: NpmBunUpdateStrategy
  [key: string]: unknown
}

export function getConfigDir(): string {
  return join(homedir(), '.quantex')
}

export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json')
}

export async function loadConfig(): Promise<QuantexConfig> {
  const { config } = await c12LoadConfig({
    name: 'quantex',
    defaults: defaultConfig,
    configFile: getConfigFilePath(),
  })
  const normalizedConfig = config as Record<string, unknown>
  return {
    ...normalizedConfig,
    defaultPackageManager: normalizedConfig.defaultPackageManager === 'npm' ? 'npm' : 'bun',
    npmBunUpdateStrategy: normalizedConfig.npmBunUpdateStrategy === 'respect-semver' ? 'respect-semver' : 'latest-major',
  } as QuantexConfig
}

export function isNpmBunUpdateStrategy(value: string): value is NpmBunUpdateStrategy {
  return value === 'latest-major' || value === 'respect-semver'
}

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await Bun.write(getConfigFilePath(), `${JSON.stringify(config, null, 2)}\n`)
}
