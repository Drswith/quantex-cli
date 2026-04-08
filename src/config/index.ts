import { mkdir } from 'node:fs/promises'
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

export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json')
}

export async function loadConfig(): Promise<QuantexConfig> {
  const { config } = await c12LoadConfig({
    name: 'quantex',
    defaults: defaultConfig,
    configFile: getConfigFilePath(),
  })
  return config as QuantexConfig
}

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await Bun.write(getConfigFilePath(), `${JSON.stringify(config, null, 2)}\n`)
}
