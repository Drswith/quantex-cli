import type { Platform } from '../agents/types'
import process from 'node:process'
import { getPlatform } from '../utils/detect'

export async function runBinaryInstall(commandOrFn: string | ((platform: Platform) => string)): Promise<boolean> {
  const platform = getPlatform()
  const command = typeof commandOrFn === 'function' ? commandOrFn(platform) : commandOrFn

  try {
    let proc: ReturnType<typeof Bun.spawn>
    if (process.platform === 'win32') {
      proc = Bun.spawn(['powershell.exe', '-Command', command], {
        stdio: ['inherit', 'inherit', 'inherit'] as const,
      })
    }
    else {
      proc = Bun.spawn(['sh', '-c', command], {
        stdio: ['inherit', 'inherit', 'inherit'] as const,
      })
    }
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}
