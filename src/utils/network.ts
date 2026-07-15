import type { ProviderOperationContext } from '../providers'
import type { NetworkPort } from '../runtime/ports'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getCliContext, recordCliFreshness } from '../cli-context'
import { getConfigDir, loadConfig } from '../config'
import { ProcessInterruptionError } from './child-process'

interface CachedResponseEntry {
  body: string
  etag?: string
  expiresAt: number
  fetchedAt?: number
}

interface CachedResponseStore {
  entries: Record<string, CachedResponseEntry>
}

interface NetworkOperationOptions {
  context?: ProviderOperationContext
  networkPort?: NetworkPort
  signal?: AbortSignal
}

interface FetchedTextResponse {
  body?: string
  etag?: string
  ok: boolean
  status: number
  valid: boolean
}

class NetworkAttemptTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Network attempt timed out after ${timeoutMs}ms.`)
    this.name = 'NetworkAttemptTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export async function fetchJsonWithCache<T>(
  url: string,
  cacheKey: string,
  options: NetworkOperationOptions = {},
): Promise<T | undefined> {
  const body = await fetchTextWithCache(url, cacheKey, 'json', options)
  if (!body) return undefined

  try {
    return JSON.parse(body) as T
  } catch {
    return undefined
  }
}

export async function fetchTextWithCache(
  url: string,
  cacheKey: string,
  mode: 'json' | 'text' = 'text',
  options: NetworkOperationOptions = {},
): Promise<string | undefined> {
  const signal = options.context?.signal ?? options.signal
  throwIfAborted(signal)
  const config = await loadConfig()
  throwIfAborted(signal)
  const ttlMs = config.versionCacheTtlHours * 60 * 60 * 1000
  const cacheMode = getCliContext().cacheMode
  const cache = cacheMode === 'no-cache' ? { entries: {} } : await loadResponseCache()
  throwIfAborted(signal)
  const cachedEntry = cache.entries[cacheKey]
  const now = Date.now()

  if (cacheMode === 'default' && cachedEntry && cachedEntry.expiresAt > now) {
    throwIfAborted(signal)
    recordCachedEntryFreshness(cachedEntry, ttlMs)
    return cachedEntry.body
  }

  const response = await fetchTextWithRetries(url, {
    context: options.context,
    headers: cacheMode !== 'no-cache' && cachedEntry?.etag ? { 'If-None-Match': cachedEntry.etag } : undefined,
    mode,
    networkPort: options.networkPort,
    retries: config.networkRetries,
    signal,
    timeoutMs: config.networkTimeoutMs,
  })
  throwIfAborted(signal)

  if (!response) {
    if (cachedEntry) {
      throwIfAborted(signal)
      recordCachedEntryFreshness(cachedEntry, ttlMs)
    }
    return cachedEntry?.body
  }

  if (response.status === 304 && cachedEntry) {
    throwIfAborted(signal)
    cache.entries[cacheKey] = {
      ...cachedEntry,
      expiresAt: now + ttlMs,
      fetchedAt: now,
    }
    if (cacheMode !== 'no-cache') {
      throwIfAborted(signal)
      await saveResponseCache(cache)
    }
    throwIfAborted(signal)
    recordNetworkFreshness(now, now + ttlMs)
    return cachedEntry.body
  }

  if (!response.ok) {
    if (cachedEntry) {
      throwIfAborted(signal)
      recordCachedEntryFreshness(cachedEntry, ttlMs)
    }
    return cachedEntry?.body
  }

  if (!response.valid || response.body === undefined) {
    if (cachedEntry) {
      throwIfAborted(signal)
      recordCachedEntryFreshness(cachedEntry, ttlMs)
    }
    return cachedEntry?.body
  }

  throwIfAborted(signal)
  const entry = {
    body: response.body,
    etag: response.etag,
    expiresAt: now + ttlMs,
    fetchedAt: now,
  }
  if (cacheMode !== 'no-cache') {
    cache.entries[cacheKey] = entry
    throwIfAborted(signal)
    await saveResponseCache(cache)
  }
  throwIfAborted(signal)
  recordNetworkFreshness(now, now + ttlMs)

  return response.body
}

async function fetchTextWithRetries(
  url: string,
  options: {
    context?: ProviderOperationContext
    headers?: Record<string, string>
    mode: 'json' | 'text'
    networkPort?: NetworkPort
    retries: number
    signal?: AbortSignal
    timeoutMs: number
  },
): Promise<FetchedTextResponse | undefined> {
  const invocationDeadline =
    options.context?.timeoutMs === undefined ? undefined : Date.now() + options.context.timeoutMs
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await fetchTextAttempt(url, { ...options, invocationDeadline })
    } catch (error) {
      if (error instanceof ProcessInterruptionError) throw error
      if (attempt === options.retries) return undefined
    }
  }

  return undefined
}

async function fetchTextAttempt(
  url: string,
  options: {
    context?: ProviderOperationContext
    headers?: Record<string, string>
    invocationDeadline?: number
    mode: 'json' | 'text'
    networkPort?: NetworkPort
    signal?: AbortSignal
    timeoutMs: number
  },
): Promise<FetchedTextResponse> {
  const networkPort = options.networkPort
  if (networkPort) return fetchTextAttemptWithPort(url, { ...options, networkPort })

  const controller = new AbortController()
  let reader: { cancel(reason?: unknown): Promise<void> } | undefined
  let response: Response | undefined
  let interruption: NetworkAttemptTimeoutError | ProcessInterruptionError | undefined
  let rejectInterruption!: (error: NetworkAttemptTimeoutError | ProcessInterruptionError) => void
  let cancellation: Promise<void> | undefined
  const interrupted = new Promise<never>((_resolve, reject) => (rejectInterruption = reject))
  const cancelResponse = (): Promise<void> =>
    (cancellation ??= settleBounded(
      Promise.resolve()
        .then(async () => {
          if (reader) await reader.cancel(interruption)
          else if (response?.body && !response.body.locked) await response.body.cancel(interruption)
          return undefined
        })
        .then(() => undefined)
        .catch(() => undefined),
      250,
    ))
  const interrupt = (kind: 'cancelled' | 'invocation-timeout' | 'network-timeout'): Promise<void> => {
    const nextInterruption =
      kind === 'cancelled'
        ? cancelledError(options.signal)
        : kind === 'invocation-timeout'
          ? new ProcessInterruptionError({
              kind: 'timed-out',
              timeoutMs: options.context?.timeoutMs ?? 0,
            })
          : new NetworkAttemptTimeoutError(options.timeoutMs)
    const firstInterruption = interruption === undefined
    if (
      firstInterruption ||
      (interruption instanceof NetworkAttemptTimeoutError && nextInterruption instanceof ProcessInterruptionError)
    )
      interruption = nextInterruption
    if (firstInterruption) {
      controller.abort(interruption)
      void cancelResponse().finally(() => rejectInterruption(interruption!))
    }
    return cancelResponse()
  }
  const abort = () => void interrupt('cancelled')
  options.signal?.addEventListener('abort', abort, { once: true })
  const unregisterCleanup = options.context?.registerCleanup?.({
    cleanup: () => interrupt('cancelled'),
    force: cancelResponse,
  })
  const networkDeadline = Date.now() + options.timeoutMs
  const timeout = setTimeout(() => void interrupt('network-timeout'), options.timeoutMs)
  const invocationTimeout =
    options.invocationDeadline === undefined
      ? undefined
      : setTimeout(() => void interrupt('invocation-timeout'), Math.max(0, options.invocationDeadline - Date.now()))
  const ensureActive = async (): Promise<void> => {
    if (interruption) throw interruption
    if (options.signal?.aborted) await interrupt('cancelled')
    else if (options.invocationDeadline !== undefined && Date.now() >= options.invocationDeadline)
      await interrupt('invocation-timeout')
    else if (Date.now() >= networkDeadline) await interrupt('network-timeout')
    if (interruption) throw interruption
  }

  try {
    if (options.signal?.aborted) await interrupt('cancelled')
    const consume = (async (): Promise<FetchedTextResponse> => {
      response = await fetch(url, { headers: options.headers, signal: controller.signal })
      await ensureActive()
      const status = response.status
      const etag = response.headers?.get?.('etag') ?? undefined
      if (!response.ok) {
        await cancelResponse()
        return { etag, ok: false, status, valid: true }
      }
      const body = await readResponseBody(response, value => (reader = value))
      await ensureActive()
      let valid = true
      if (options.mode === 'json') {
        try {
          JSON.parse(body)
        } catch {
          valid = false
        }
      }
      await ensureActive()
      return { body, etag, ok: true, status, valid }
    })()
    try {
      return await Promise.race([consume, interrupted])
    } catch (error) {
      if (interruption) {
        await cancelResponse()
        throw interruption
      }
      throw error
    }
  } finally {
    clearTimeout(timeout)
    if (invocationTimeout) clearTimeout(invocationTimeout)
    options.signal?.removeEventListener('abort', abort)
    unregisterCleanup?.()
  }
}

async function fetchTextAttemptWithPort(
  url: string,
  options: {
    context?: ProviderOperationContext
    headers?: Record<string, string>
    invocationDeadline?: number
    mode: 'json' | 'text'
    networkPort: NetworkPort
    signal?: AbortSignal
    timeoutMs: number
  },
): Promise<FetchedTextResponse> {
  if (options.signal?.aborted) throw cancelledError(options.signal)
  const now = Date.now()
  if (options.invocationDeadline !== undefined && options.invocationDeadline <= now)
    throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: options.context?.timeoutMs ?? 0 })
  const timeoutMs =
    options.invocationDeadline === undefined
      ? options.timeoutMs
      : Math.max(1, Math.min(options.timeoutMs, options.invocationDeadline - now))
  const signal = options.signal ?? new AbortController().signal
  const outcome = await options.networkPort.request({ headers: options.headers, signal, timeoutMs, url })
  if (outcome.kind === 'failure') {
    if (options.signal?.aborted || outcome.error.kind === 'cancelled') throw cancelledError(options.signal)
    if (outcome.error.kind === 'timed-out') {
      if (options.invocationDeadline !== undefined && Date.now() >= options.invocationDeadline)
        throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: options.context?.timeoutMs ?? 0 })
      throw new NetworkAttemptTimeoutError(options.timeoutMs)
    }
    throw new Error(outcome.error.message)
  }

  const body = new TextDecoder().decode(outcome.value.body)
  let valid = true
  if (options.mode === 'json' && outcome.value.status >= 200 && outcome.value.status < 300) {
    try {
      JSON.parse(body)
    } catch {
      valid = false
    }
  }
  return {
    body: outcome.value.status >= 200 && outcome.value.status < 300 ? body : undefined,
    etag: outcome.value.headers.etag,
    ok: outcome.value.status >= 200 && outcome.value.status < 300,
    status: outcome.value.status,
    valid,
  }
}

async function readResponseBody(
  response: Response,
  setReader: (reader: { cancel(reason?: unknown): Promise<void> }) => void,
): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  setReader(reader)
  const decoder = new TextDecoder()
  let body = ''
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    body += decoder.decode(chunk.value, { stream: true })
  }
  return body + decoder.decode()
}

async function settleBounded(work: Promise<void>, timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      work,
      new Promise<void>(resolve => {
        timeout = setTimeout(resolve, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelledError(signal)
}

function cancelledError(signal?: AbortSignal): ProcessInterruptionError {
  if (signal?.reason instanceof ProcessInterruptionError) return signal.reason
  const reason =
    typeof signal?.reason === 'string'
      ? signal.reason
      : signal?.reason instanceof Error
        ? signal.reason.message
        : signal?.reason === undefined
          ? undefined
          : String(signal.reason)
  return new ProcessInterruptionError({ kind: 'cancelled', reason })
}

async function loadResponseCache(): Promise<CachedResponseStore> {
  try {
    return JSON.parse(await readFile(getCacheFilePath(), 'utf8')) as CachedResponseStore
  } catch {
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
