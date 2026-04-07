import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadConfig as c12LoadConfig } from 'c12'
import { defaultConfig } from './default'

export interface SilverConfig {
  defaultPackageManager: 'bun' | 'npm'
  [key: string]: unknown
}

export function getConfigDir(): string {
  return join(homedir(), '.silver')
}

export async function loadConfig(): Promise<SilverConfig> {
  const { config } = await c12LoadConfig({
    name: 'silver',
    defaults: defaultConfig,
    configFile: join(getConfigDir(), 'config.json'),
  })
  return config as SilverConfig
}
