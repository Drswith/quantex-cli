import type { ProviderOperationContext } from '../providers'
import type { ExecutableSearchInputs } from './executable-search-paths'
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  isProcessInterruptionError,
  readProcessOutput,
  readProcessOutputWithContext,
  spawnCommand,
} from './child-process'
import { getExecutableCandidateNames, getKnownAgentInstallDirectories } from './executable-search-paths'

function currentSearchInputs(): ExecutableSearchInputs {
  return { env: process.env, homeDir: homedir(), platform: process.platform }
}

async function lookupThroughPath(binaryName: string, context?: ProviderOperationContext): Promise<string | undefined> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const proc = spawnCommand([cmd, binaryName], {
      detached: context !== undefined && process.platform !== 'win32',
    })
    const { exitCode, stdout } = context
      ? await readProcessOutputWithContext(proc, context)
      : await readProcessOutput(proc)
    if (exitCode !== 0) return undefined
    return stdout.trim().split('\n')[0]?.trim() || undefined
  } catch (error) {
    if (isProcessInterruptionError(error)) throw error
    return undefined
  }
}

async function findInKnownDirectories(binaryName: string, inputs: ExecutableSearchInputs): Promise<string | undefined> {
  const candidates = getExecutableCandidateNames(binaryName, inputs)
  for (const directory of getKnownAgentInstallDirectories(inputs)) {
    for (const candidate of candidates) {
      const path = join(directory, candidate)
      try {
        await access(path, constants.X_OK)
        return path
      } catch {
        // Continue through the remaining known directories.
      }
    }
  }
  return undefined
}

/**
 * Resolves an agent executable to an absolute path. The inherited PATH is
 * authoritative; the known install directories are consulted only when the PATH
 * lookup does not resolve, so existing setups keep resolving exactly as before.
 */
export async function resolveAgentExecutablePath(
  binaryName: string,
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  const fromPath = await lookupThroughPath(binaryName, context)
  if (fromPath) return fromPath
  if (context?.signal.aborted) return undefined
  return findInKnownDirectories(binaryName, currentSearchInputs())
}

export async function isAgentExecutableAvailable(
  binaryName: string,
  context?: ProviderOperationContext,
): Promise<boolean> {
  return (await resolveAgentExecutablePath(binaryName, context)) !== undefined
}
