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
  }
  catch (error) {
    if (isResourceLockError(error))
      return undefined

    throw error
  }
}
