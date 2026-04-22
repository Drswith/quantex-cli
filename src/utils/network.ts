import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getCliContext, recordCliFreshness } from '../cli-context'
import { getConfigDir, loadConfig } from '../config'

interface CachedResponseEntry {
  body: string
  etag?: string
  expiresAt: number
  fetchedAt?: number
}

interface CachedResponseStore {
  entries: Record<string, CachedResponseEntry>
}

export async function fetchJsonWithCache<T>(url: string, cacheKey: string): Promise<T | undefined> {
  const body = await fetchTextWithCache(url, cacheKey, 'json')
  if (!body)
    return undefined

  try {
    return JSON.parse(body) as T
  }
  catch {
    return undefined
  }
}

export async function fetchTextWithCache(url: string, cacheKey: string, mode: 'json' | 'text' = 'text'): Promise<string | undefined> {
  const config = await loadConfig()
  const ttlMs = config.versionCacheTtlHours * 60 * 60 * 1000
  const cacheMode = getCliContext().cacheMode
  const cache = cacheMode === 'no-cache' ? { entries: {} } : await loadResponseCache()
  const cachedEntry = cache.entries[cacheKey]
  const now = Date.now()

  if (cacheMode === 'default' && cachedEntry && cachedEntry.expiresAt > now) {
    recordCachedEntryFreshness(cachedEntry, ttlMs)
    return cachedEntry.body
  }

  const response = await fetchWithRetries(url, {
    headers: cacheMode !== 'no-cache' && cachedEntry?.etag ? { 'If-None-Match': cachedEntry.etag } : undefined,
    retries: config.networkRetries,
    timeoutMs: config.networkTimeoutMs,
  })

  if (!response) {
    if (cachedEntry)
      recordCachedEntryFreshness(cachedEntry, ttlMs)
    return cachedEntry?.body
  }

  if (response.status === 304 && cachedEntry) {
    cache.entries[cacheKey] = {
      ...cachedEntry,
      expiresAt: now + ttlMs,
      fetchedAt: now,
    }
    if (cacheMode !== 'no-cache')
      await saveResponseCache(cache)
    recordNetworkFreshness(now, now + ttlMs)
    return cachedEntry.body
  }

  if (!response.ok) {
    if (cachedEntry)
      recordCachedEntryFreshness(cachedEntry, ttlMs)
    return cachedEntry?.body
  }

  const body = await response.text()

  if (mode === 'json') {
    try {
      JSON.parse(body)
    }
    catch {
      if (cachedEntry)
        recordCachedEntryFreshness(cachedEntry, ttlMs)
      return cachedEntry?.body
    }
  }

  const entry = {
    body,
    etag: response.headers.get('etag') ?? undefined,
    expiresAt: now + ttlMs,
    fetchedAt: now,
  }
  if (cacheMode !== 'no-cache') {
    cache.entries[cacheKey] = entry
    await saveResponseCache(cache)
  }
  recordNetworkFreshness(now, now + ttlMs)

  return body
}

async function fetchWithRetries(
  url: string,
  options: { headers?: Record<string, string>, retries: number, timeoutMs: number },
): Promise<Response | undefined> {
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      return await fetch(url, {
        headers: options.headers,
        signal: controller.signal,
      })
    }
    catch {
      if (attempt === options.retries)
        return undefined
    }
    finally {
      clearTimeout(timeout)
    }
  }

  return undefined
}

async function loadResponseCache(): Promise<CachedResponseStore> {
  try {
    return JSON.parse(await readFile(getCacheFilePath(), 'utf8')) as CachedResponseStore
  }
  catch {
    return { entries: {} }
  }
}

async function saveResponseCache(cache: CachedResponseStore): Promise<void> {
  await mkdir(join(getConfigDir(), 'cache'), { recursive: true })
  await writeFile(getCacheFilePath(), `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
}

function getCacheFilePath(): string {
  return join(getConfigDir(), 'cache', 'versions.json')
}

function recordCachedEntryFreshness(entry: CachedResponseEntry, ttlMs: number): void {
  const fetchedAtMs = entry.fetchedAt ?? Math.max(0, entry.expiresAt - ttlMs)
  recordCliFreshness({
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    source: 'cache',
    staleAfter: new Date(entry.expiresAt).toISOString(),
  })
}

function recordNetworkFreshness(fetchedAt: number, staleAfter: number): void {
  recordCliFreshness({
    fetchedAt: new Date(fetchedAt).toISOString(),
    source: 'network',
    staleAfter: new Date(staleAfter).toISOString(),
  })
}
