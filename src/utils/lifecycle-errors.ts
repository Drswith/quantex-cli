import type { CommandError, CommandTarget } from '../output/types'
import type { ResourceLockError } from './lock'

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
