import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
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

  await createLockDirectory(options.resource, lockPath)
  await writeLockOwner(lockPath)

  return async () => {
    await rm(lockPath, { force: true, recursive: true })
  }
}

async function createLockDirectory(resource: string, lockPath: string): Promise<void> {
  try {
    await mkdir(lockPath, { recursive: false })
    return
  } catch (error) {
    if (!isFileExistsError(error)) throw error
  }

  if (!(await removeStaleLock(lockPath))) throw new ResourceLockError(resource, lockPath)

  try {
    await mkdir(lockPath, { recursive: false })
  } catch (error) {
    if (isFileExistsError(error)) throw new ResourceLockError(resource, lockPath)

    throw error
  }
}

async function writeLockOwner(lockPath: string): Promise<void> {
  await writeFile(
    join(lockPath, 'owner.json'),
    `${JSON.stringify({
      pid: process.pid,
      createdAt: new Date().toISOString(),
    })}\n`,
    'utf8',
  )
}

async function removeStaleLock(lockPath: string): Promise<boolean> {
  const owner = await readLockOwner(lockPath)

  if (owner && isProcessAlive(owner.pid)) return false

  await rm(lockPath, { force: true, recursive: true })
  return true
}

async function readLockOwner(lockPath: string): Promise<{ pid: number } | undefined> {
  try {
    const owner = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8')) as { pid?: unknown }
    return typeof owner.pid === 'number' && Number.isInteger(owner.pid) && owner.pid > 0
      ? { pid: owner.pid }
      : undefined
  } catch {
    return undefined
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined
    return code === 'EPERM'
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'EEXIST'
  )
}

export async function withResourceLock<T>(options: ResourceLockOptions, run: () => Promise<T>): Promise<T> {
  const release = await acquireResourceLock(options)

  try {
    return await run()
  } finally {
    await release()
  }
}
