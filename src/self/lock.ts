import type { LockPort, RuntimeOutcome } from '../runtime'
import { acquireResourceLock, getResourceLockPath, isResourceLockError } from '../utils/lock'

export function getSelfUpgradeLockPath(): string {
  return getResourceLockPath(['self-upgrade'])
}

export async function acquireSelfUpgradeLock(): Promise<(() => Promise<void>) | undefined> {
  try {
    return await acquireResourceLock({
      resource: 'self upgrade',
      scope: ['self-upgrade'],
    })
  } catch (error) {
    if (isResourceLockError(error)) return undefined

    throw error
  }
}

export function createSelfUpgradeLockPort(): LockPort {
  return {
    async acquire(request) {
      if (request.signal.aborted) return failure('cancelled', 'Self-upgrade lock acquisition was cancelled.')
      if (request.scope.length !== 1 || request.scope[0] !== 'self-upgrade')
        return failure('unavailable', `Unsupported self-upgrade lock scope: ${request.scope.join('/')}`)

      const release = await acquireSelfUpgradeLock()
      if (!release) return failure('conflict', 'Another qtx upgrade is already running.')
      if (request.signal.aborted) {
        await release()
        return failure('cancelled', 'Self-upgrade lock acquisition was cancelled.')
      }

      let released = false
      return {
        kind: 'success',
        value: {
          async release(): Promise<RuntimeOutcome<void>> {
            if (released) return { kind: 'success', value: undefined }
            released = true
            try {
              await release()
              return { kind: 'success', value: undefined }
            } catch (error) {
              return failure('failed', error instanceof Error ? error.message : 'Failed to release self-upgrade lock.')
            }
          },
        },
      }
    },
  }
}

function failure(kind: 'cancelled' | 'conflict' | 'failed' | 'unavailable', message: string): RuntimeOutcome<never> {
  return { error: { kind, message }, kind: 'failure' }
}
