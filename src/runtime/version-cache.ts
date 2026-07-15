import type { CacheMode } from '../cli-context'
import type { CacheLookup, CachePort, RuntimeFailure, RuntimeOutcome } from './ports'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getCliContext } from '../cli-context'
import { getConfigDir } from '../config'

interface CachedResponseEntry {
  body: string
  etag?: string
  expiresAt: number
  fetchedAt?: number
}

interface CachedResponseStore {
  entries: Record<string, CachedResponseEntry>
}

export interface VersionCachePortOptions {
  readonly filePath?: string
  readonly getCacheMode?: () => CacheMode
  readonly now?: () => number
}

export function createVersionCachePort(options: VersionCachePortOptions = {}): CachePort {
  const filePath = options.filePath ?? join(getConfigDir(), 'cache', 'versions.json')
  const getCacheMode = options.getCacheMode ?? (() => getCliContext().cacheMode ?? 'default')
  const now = options.now ?? Date.now

  return {
    async read(request): Promise<RuntimeOutcome<CacheLookup>> {
      const interrupted = interruption(request.signal)
      if (interrupted) return interrupted
      if (getCacheMode() === 'no-cache') return success({ kind: 'miss' })

      try {
        const store = await loadStore(filePath)
        const afterRead = interruption(request.signal)
        if (afterRead) return afterRead
        const entry = store.entries[request.key]
        if (!entry || entry.expiresAt <= now()) return success({ kind: 'miss' })

        try {
          return success({
            expiresAtMs: entry.expiresAt,
            kind: 'hit',
            value: JSON.parse(entry.body) as unknown,
          })
        } catch {
          return failure('invalid-data', `Cached value for ${request.key} is not valid JSON.`)
        }
      } catch (error) {
        return fromError(error, 'Failed to read the version cache.')
      }
    },
    async remove(request): Promise<RuntimeOutcome<void>> {
      const interrupted = interruption(request.signal)
      if (interrupted) return interrupted
      if (getCacheMode() === 'no-cache') return success(undefined)

      try {
        const store = await loadStore(filePath)
        const afterRead = interruption(request.signal)
        if (afterRead) return afterRead
        if (!Object.hasOwn(store.entries, request.key)) return success(undefined)
        delete store.entries[request.key]
        await saveStore(filePath, store)
        return interruption(request.signal) ?? success(undefined)
      } catch (error) {
        return fromError(error, 'Failed to remove a version cache entry.')
      }
    },
    async write(request): Promise<RuntimeOutcome<void>> {
      const interrupted = interruption(request.signal)
      if (interrupted) return interrupted
      if (getCacheMode() === 'no-cache') return success(undefined)

      try {
        const store = await loadStore(filePath)
        const afterRead = interruption(request.signal)
        if (afterRead) return afterRead
        const fetchedAt = now()
        const body = JSON.stringify(request.value)
        if (body === undefined)
          return failure('invalid-data', `Cached value for ${request.key} is not JSON serializable.`)
        store.entries[request.key] = {
          body,
          expiresAt: request.expiresAtMs ?? Number.MAX_SAFE_INTEGER,
          fetchedAt,
        }
        await saveStore(filePath, store)
        return interruption(request.signal) ?? success(undefined)
      } catch (error) {
        return fromError(error, 'Failed to write the version cache.')
      }
    },
  }
}

async function loadStore(filePath: string): Promise<CachedResponseStore> {
  try {
    return parseStore(JSON.parse(await readFile(filePath, 'utf8')) as unknown)
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) return { entries: {} }
    throw error
  }
}

async function saveStore(filePath: string, store: CachedResponseStore): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

function parseStore(value: unknown): CachedResponseStore {
  if (!isRecord(value) || !isRecord(value.entries)) return { entries: {} }
  const entries: Record<string, CachedResponseEntry> = {}
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isRecord(entry) || typeof entry.body !== 'string' || !isTimestamp(entry.expiresAt)) continue
    entries[key] = {
      body: entry.body,
      etag: typeof entry.etag === 'string' ? entry.etag : undefined,
      expiresAt: entry.expiresAt,
      fetchedAt: isTimestamp(entry.fetchedAt) ? entry.fetchedAt : undefined,
    }
  }
  return { entries }
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}

function failure(kind: RuntimeFailure['kind'], message: string, code?: string): RuntimeOutcome<never> {
  return { error: { code, kind, message }, kind: 'failure' }
}

function interruption(signal: AbortSignal): RuntimeOutcome<never> | undefined {
  return signal.aborted ? failure('cancelled', 'Cache operation was cancelled.') : undefined
}

function fromError(error: unknown, message: string): RuntimeOutcome<never> {
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined
  return failure('failed', message, code)
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
