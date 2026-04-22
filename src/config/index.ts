import type { Jiti } from 'jiti'
import type { SelfUpdateChannel } from '../self/types'
import { mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { loadConfig as c12LoadConfig } from 'c12'
import { defaultConfig } from './default'

export type NpmBunUpdateStrategy = 'latest-major' | 'respect-semver'

export interface QuantexConfig {
  defaultPackageManager: 'bun' | 'npm'
  npmBunUpdateStrategy: NpmBunUpdateStrategy
  selfUpdateChannel: SelfUpdateChannel
  [key: string]: unknown
}

export function getConfigDir(): string {
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), '.quantex')
}

export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json')
}

export async function loadConfig(): Promise<QuantexConfig> {
  const jiti = {
    import: async (id: string, options?: { default?: boolean }) => {
      if (id.endsWith('.json')) {
        return JSON.parse(await readFile(id, 'utf8'))
      }

      const module = await import(id.startsWith('file:') ? id : pathToFileURL(id).href)
      return options?.default ? (module.default ?? module) : module
    },
  } as unknown as Jiti

  const { config } = await c12LoadConfig({
    name: 'quantex',
    defaults: defaultConfig,
    configFile: getConfigFilePath(),
    jiti,
  })
  const normalizedConfig = config as Record<string, unknown>
  return {
    ...normalizedConfig,
    defaultPackageManager: normalizedConfig.defaultPackageManager === 'npm' ? 'npm' : 'bun',
    npmBunUpdateStrategy: normalizedConfig.npmBunUpdateStrategy === 'respect-semver' ? 'respect-semver' : 'latest-major',
    selfUpdateChannel: normalizedConfig.selfUpdateChannel === 'beta' ? 'beta' : 'stable',
  } as QuantexConfig
}

export function isNpmBunUpdateStrategy(value: string): value is NpmBunUpdateStrategy {
  return value === 'latest-major' || value === 'respect-semver'
}

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await Bun.write(getConfigFilePath(), `${JSON.stringify(config, null, 2)}\n`)
}
