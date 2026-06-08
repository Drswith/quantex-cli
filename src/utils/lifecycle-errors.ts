import type { CommandError, CommandTarget } from '../output/types'
import type { StateFileError } from '../state'
import type { ResourceLockError } from './lock'

export function createStateReadError(
  error: StateFileError,
  stateFilePath: string,
  target?: CommandTarget,
): { error: CommandError; target?: CommandTarget } {
  return {
    error: {
      code: 'STATE_READ_ERROR',
      details: {
        stateFilePath,
      },
      message: error.message,
    },
    target,
  }
}

export function createResourceLockedError(
  error: ResourceLockError,
  target?: CommandTarget,
): { error: CommandError; target?: CommandTarget } {
  return {
    error: {
      code: 'RESOURCE_LOCKED',
      details: {
        lockPath: error.lockPath,
        resource: error.resource,
      },
      message: error.message,
    },
    target,
  }
}
