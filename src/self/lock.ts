import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getConfigDir } from '../config'

export function getSelfUpgradeLockPath(): string {
  return join(getConfigDir(), 'locks', 'self-upgrade.lock')
}

export async function acquireSelfUpgradeLock(): Promise<(() => Promise<void>) | undefined> {
  const lockPath = getSelfUpgradeLockPath()
  await mkdir(dirname(lockPath), { recursive: true })

  try {
    await mkdir(lockPath, { recursive: false })
  }
  catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: unknown }).code === 'EEXIST')
      return undefined

    throw error
  }

  return async () => {
    await rm(lockPath, { force: true, recursive: true })
  }
}
