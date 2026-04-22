import pc from 'picocolors'
import { isNpmBunUpdateStrategy, loadConfig, saveConfig } from '../config'
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
      if (key === 'defaultPackageManager' && value !== 'bun' && value !== 'npm') {
        console.log(pc.red('defaultPackageManager must be bun or npm'))
        return
      }
      if (key === 'npmBunUpdateStrategy' && !isNpmBunUpdateStrategy(value)) {
        console.log(pc.red('npmBunUpdateStrategy must be latest-major or respect-semver'))
        return
      }
      if (key === 'selfUpdateChannel' && value !== 'stable' && value !== 'beta') {
        console.log(pc.red('selfUpdateChannel must be stable or beta'))
        return
      }
      let existing: Record<string, unknown> = {}
      try {
        existing = await loadConfig()
      }
      catch {
      }

      existing[key] = value
      await saveConfig(existing)
      console.log(pc.green(`Set ${key} = ${value}`))
      break
    }
    case 'reset': {
      await saveConfig(defaultConfig)
      console.log(pc.green('Configuration reset to defaults.'))
      break
    }
    default:
      console.log(pc.red(`Unknown action: ${action}`))
      console.log('Available actions: get, set, reset')
  }
}
