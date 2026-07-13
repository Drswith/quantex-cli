import type { Platform } from '../agents/types'
import type { ProviderOperationContext } from '../providers'
import process from 'node:process'
import {
  isProcessInterruptionError,
  readProcessOutput,
  readProcessOutputWithContext,
  spawnCommand,
} from './child-process'

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

async function isCommandAvailable(command: string, context?: ProviderOperationContext): Promise<boolean> {
  try {
    const proc = spawnCommand([command, '--version'], {
      detached: context !== undefined && process.platform !== 'win32',
    })
    const { exitCode } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    return exitCode === 0
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return false
  }
}

export async function isBunAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('bun', context)
}

export async function isNpmAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('npm', context)
}

export async function isBrewAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('brew', context)
}

export async function isDenoAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('deno', context)
}

export async function isCargoAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('cargo', context)
}

export async function isMiseAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('mise', context)
}

export async function isWingetAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('winget', context)
}

export async function isPipAvailable(context?: ProviderOperationContext): Promise<boolean> {
  if (await isCommandAvailable('pip', context)) return true
  if (await isCommandAvailable('pip3', context)) return true
  return isPythonModulePipAvailable(context)
}

export async function isUvAvailable(context?: ProviderOperationContext): Promise<boolean> {
  return isCommandAvailable('uv', context)
}

async function isPythonModulePipAvailable(context?: ProviderOperationContext): Promise<boolean> {
  try {
    const proc = spawnCommand(['python', '-m', 'pip', '--version'], {
      detached: context !== undefined && process.platform !== 'win32',
    })
    const { exitCode } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    if (exitCode === 0) return true
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    /* ignore */
  }
  try {
    const proc = spawnCommand(['python3', '-m', 'pip', '--version'], {
      detached: context !== undefined && process.platform !== 'win32',
    })
    const { exitCode } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    return exitCode === 0
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return false
  }
}

export async function isBinaryInPath(binaryName: string, context?: ProviderOperationContext): Promise<boolean> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const proc = spawnCommand([cmd, binaryName], {
      detached: context !== undefined && process.platform !== 'win32',
    })
    const { exitCode } = context ? await readProcessOutputWithContext(proc, context) : await readProcessOutput(proc)
    return exitCode === 0
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return false
  }
}
