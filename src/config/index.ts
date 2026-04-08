import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadConfig as c12LoadConfig } from 'c12'
import { defaultConfig } from './default'

export interface QuantexConfig {
  defaultPackageManager: 'bun' | 'npm'
  [key: string]: unknown
}

export function getConfigDir(): string {
  return join(homedir(), '.quantex')
}

export async function loadConfig(): Promise<QuantexConfig> {
  const { config } = await c12LoadConfig({
    name: 'quantex',
    defaults: defaultConfig,
    configFile: join(getConfigDir(), 'config.json'),
  })
  return config as QuantexConfig
}
