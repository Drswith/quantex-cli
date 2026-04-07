import { join } from 'node:path'
import pc from 'picocolors'
import { getConfigDir, loadConfig } from '../config'
import { defaultConfig } from '../config/default'

export async function configCommand(action?: string, key?: string, value?: string): Promise<void> {
  if (!action) {
    const config = await loadConfig()
    console.log(pc.bold('\nCurrent Configuration:\n'))
    console.log(JSON.stringify(config, null, 2))
    console.log()
    return
  }

  switch (action) {
    case 'get': {
      if (!key) {
        console.log(pc.red('Please specify a key'))
        return
      }
      const config = await loadConfig()
      const val = config[key]
      console.log(val !== undefined ? String(val) : pc.gray('(not set)'))
      break
    }
    case 'set': {
      if (!key || value === undefined) {
        console.log(pc.red('Please specify both key and value'))
        return
      }
      const configDir = getConfigDir()
      const configPath = join(configDir, 'config.json')

      let existing: Record<string, unknown> = {}
      try {
        const file = Bun.file(configPath)
        existing = await file.json()
      }
      catch {
        // file doesn't exist yet
      }

      existing[key] = value
      await Bun.write(configPath, JSON.stringify(existing, null, 2))
      console.log(pc.green(`Set ${key} = ${value}`))
      break
    }
    case 'reset': {
      const configDir = getConfigDir()
      const configPath = join(configDir, 'config.json')
      await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2))
      console.log(pc.green('Configuration reset to defaults.'))
      break
    }
    default:
      console.log(pc.red(`Unknown action: ${action}`))
      console.log('Available actions: get, set, reset')
  }
}
