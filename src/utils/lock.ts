import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getConfigDir } from '../config'

interface ResourceLockOptions {
  resource: string
  scope: readonly string[]
}

export class ResourceLockError extends Error {
  lockPath: string
  resource: string

  constructor(resource: string, lockPath: string) {
    super(`Another quantex process is already using the ${resource} lock.`)
    this.name = 'ResourceLockError'
    this.lockPath = lockPath
    this.resource = resource
  }
}

export function isResourceLockError(error: unknown): error is ResourceLockError {
  return error instanceof ResourceLockError
}

export function getResourceLockPath(scope: readonly string[]): string {
  const normalizedScope = scope
    .map(segment =>
      segment
        .trim()
        .replaceAll(/[^\w.-]+/g, '-')
        .replaceAll(/-+/g, '-')
        .replaceAll(/^-|-$/g, ''),
    )
    .filter(Boolean)
  const pathSegments = normalizedScope.length > 0 ? normalizedScope : ['default']
  const parentSegments = pathSegments.slice(0, -1)
  const lockName = `${pathSegments.at(-1)}.lock`

  return join(getConfigDir(), 'locks', ...parentSegments, lockName)
}

export async function acquireResourceLock(options: ResourceLockOptions): Promise<() => Promise<void>> {
  const lockPath = getResourceLockPath(options.scope)
  await mkdir(dirname(lockPath), { recursive: true })

  try {
    await mkdir(lockPath, { recursive: false })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: unknown }).code === 'EEXIST')
      throw new ResourceLockError(options.resource, lockPath)

    throw error
  }

  return async () => {
    await rm(lockPath, { force: true, recursive: true })
  }
}

export async function withResourceLock<T>(options: ResourceLockOptions, run: () => Promise<T>): Promise<T> {
  const release = await acquireResourceLock(options)

  try {
    return await run()
  } finally {
    await release()
  }
}
