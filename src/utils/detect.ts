import type { Platform } from '../agents/types'
import process from 'node:process'

export function getPlatform(): Platform {
  switch (process.platform) {
    case 'win32':
      return 'windows'
    case 'darwin':
      return 'macos'
    default:
      return 'linux'
  }
}

async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn([command, '--version'], { stdout: 'pipe', stderr: 'pipe' })
    await proc.exited
    return proc.exitCode === 0
  } catch {
    return false
  }
}

export async function isBunAvailable(): Promise<boolean> {
  return isCommandAvailable('bun')
}

export async function isNpmAvailable(): Promise<boolean> {
  return isCommandAvailable('npm')
}

export async function isBrewAvailable(): Promise<boolean> {
  return isCommandAvailable('brew')
}

export async function isWingetAvailable(): Promise<boolean> {
  return isCommandAvailable('winget')
}

export async function isBinaryInPath(binaryName: string): Promise<boolean> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const proc = Bun.spawn([cmd, binaryName], { stdout: 'pipe', stderr: 'pipe' })
    await proc.exited
    return proc.exitCode === 0
  } catch {
    return false
  }
}
