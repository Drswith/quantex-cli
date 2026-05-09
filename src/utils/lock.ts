import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
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

/** Used only while deciding stale removal; covers cross-process preemption between mkdir(2) and owner write. */
const LOCK_OWNER_ACQUISITION_GRACE_MS = 100
const LOCK_OWNER_POLL_INTERVAL_MS = 2

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

  return async () => {
    await rm(lockPath, { force: true, recursive: true })
  }
}

async function createLockDirectory(resource: string, lockPath: string): Promise<void> {
  try {
    mkdirSync(lockPath, { recursive: false })
    writeLockOwnerSync(lockPath)
    return
  } catch (error) {
    if (!isFileExistsError(error)) throw error
  }

  if (!(await removeStaleLock(lockPath))) throw new ResourceLockError(resource, lockPath)

  try {
    mkdirSync(lockPath, { recursive: false })
    writeLockOwnerSync(lockPath)
  } catch (error) {
    if (isFileExistsError(error)) throw new ResourceLockError(resource, lockPath)

    throw error
  }
}

/** Synchronous write immediately after `mkdirSync` to shrink the owner-less window; `readLockOwnerDuringAcquisitionGrace` covers cross-process preemption between the two syscalls. */
function writeLockOwnerSync(lockPath: string): void {
  writeFileSync(
    join(lockPath, 'owner.json'),
    `${JSON.stringify({
      pid: process.pid,
      createdAt: new Date().toISOString(),
    })}\n`,
    'utf8',
  )
}

async function removeStaleLock(lockPath: string): Promise<boolean> {
  const owner = await readLockOwnerDuringAcquisitionGrace(lockPath)

  if (owner && isProcessAlive(owner.pid)) return false

  await rm(lockPath, { force: true, recursive: true })
  return true
}

/**
 * Another OS process may run stale recovery after our mkdir succeeded but before owner.json exists (two syscalls).
 * Briefly poll so we never rm() a live acquisition's directory or mis-classify the conflict.
 */
async function readLockOwnerDuringAcquisitionGrace(lockPath: string): Promise<{ pid: number } | undefined> {
  const deadline = Date.now() + LOCK_OWNER_ACQUISITION_GRACE_MS

  while (Date.now() < deadline) {
    const owner = await readLockOwner(lockPath)
    if (owner) return owner
    await new Promise<void>(resolve => setTimeout(resolve, LOCK_OWNER_POLL_INTERVAL_MS))
  }

  return await readLockOwner(lockPath)
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
