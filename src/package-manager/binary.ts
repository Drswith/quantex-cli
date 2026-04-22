import type { Platform } from '../agents/types'
import process from 'node:process'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'
import { getPlatform } from '../utils/detect'

export async function runBinaryInstall(commandOrFn: string | ((platform: Platform) => string)): Promise<boolean> {
  const platform = getPlatform()
  const command = typeof commandOrFn === 'function' ? commandOrFn(platform) : commandOrFn

  try {
    if (process.platform === 'win32') {
      return (await waitForSpawnedCommand(spawnWithQuantexStdio(['powershell.exe', '-Command', command]))) === 0
    }

    return (await waitForSpawnedCommand(spawnWithQuantexStdio(['sh', '-c', command]))) === 0
  }
  catch {
    return false
  }
}
