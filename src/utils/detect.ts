import type { Platform } from '../agents/types'
import process from 'node:process'
import { readProcessOutput, spawnCommand } from './child-process'

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
    const { exitCode } = await readProcessOutput(spawnCommand([command, '--version']))
    return exitCode === 0
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

export async function isCargoAvailable(): Promise<boolean> {
  return isCommandAvailable('cargo')
}

export async function isMiseAvailable(): Promise<boolean> {
  return isCommandAvailable('mise')
}

export async function isWingetAvailable(): Promise<boolean> {
  return isCommandAvailable('winget')
}

export async function isPipAvailable(): Promise<boolean> {
  if (await isCommandAvailable('pip')) return true
  if (await isCommandAvailable('pip3')) return true
  return isPythonModulePipAvailable()
}

export async function isUvAvailable(): Promise<boolean> {
  return isCommandAvailable('uv')
}

async function isPythonModulePipAvailable(): Promise<boolean> {
  try {
    const { exitCode } = await readProcessOutput(spawnCommand(['python', '-m', 'pip', '--version']))
    if (exitCode === 0) return true
  } catch {
    /* ignore */
  }
  try {
    const { exitCode } = await readProcessOutput(spawnCommand(['python3', '-m', 'pip', '--version']))
    return exitCode === 0
  } catch {
    return false
  }
}

export async function isBinaryInPath(binaryName: string): Promise<boolean> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const { exitCode } = await readProcessOutput(spawnCommand([cmd, binaryName]))
    return exitCode === 0
  } catch {
    return false
  }
}
