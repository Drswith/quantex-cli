import type { CachePort, RuntimeOutcome } from '../src/runtime'
import type { SelfInstallFacts } from '../src/self'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createVersionCachePort } from '../src/runtime'
import { planSelfUpgrade } from '../src/self/planning'
import {
  createSelfUpdateMetadata,
  getSelfUpdateMetadataCacheKey,
  parseSelfUpdateMetadata,
  readSelfUpdateMetadata,
  writeSelfUpdateMetadata,
} from '../src/self/update-metadata'

const NOW = Date.parse('2026-07-15T10:00:00.000Z')
const facts: SelfInstallFacts = {
  canAutoUpdate: true,
  currentVersion: '1.0.0',
  executablePath: '/tmp/qtx',
  installSource: 'npm',
  packageRoot: '/tmp/quantex-cli',
  updateChannel: 'stable',
}

describe('self update metadata', () => {
  it('accepts a valid unexpired record for the exact install source and channel', () => {
    const metadata = createSelfUpdateMetadata({
      expiresAtMs: NOW + 60_000,
      facts,
      fetchedAtMs: NOW,
      targetVersion: '1.1.0',
    })

    expect(parseSelfUpdateMetadata(metadata, { facts, nowMs: NOW })).toEqual(metadata)
  })

  it.each([
    ['expired', { expiresAtMs: NOW }],
    ['invalid version', { targetVersion: 'latest' }],
    ['wrong channel', { updateChannel: 'beta' }],
    ['wrong source', { installSource: 'bun' }],
    ['not installable', { canAutoUpdate: false }],
    ['future fetch time', { fetchedAtMs: NOW + 1 }],
    ['unknown schema', { schemaVersion: 2 }],
  ])('rejects %s metadata', (_label, override) => {
    const metadata = {
      ...createSelfUpdateMetadata({
        expiresAtMs: NOW + 60_000,
        facts,
        fetchedAtMs: NOW,
        targetVersion: '1.1.0',
      }),
      ...override,
    }

    expect(parseSelfUpdateMetadata(metadata, { facts, nowMs: NOW })).toBeUndefined()
  })

  it('reads only the exact metadata key and treats cache failures as absence', async () => {
    const requests: string[] = []
    const failingCache = createFakeCache({
      read: request => {
        requests.push(request.key)
        return Promise.resolve({
          error: { kind: 'failed', message: 'cache unavailable' },
          kind: 'failure',
        })
      },
    })

    await expect(
      readSelfUpdateMetadata({ cache: failingCache, facts, nowMs: NOW, signal: new AbortController().signal }),
    ).resolves.toBeUndefined()
    expect(requests).toEqual([getSelfUpdateMetadataCacheKey(facts)])
  })

  it('writes the typed record with the same expiry used by the cache port', async () => {
    const writes: Array<{ expiresAtMs?: number; key: string; value: unknown }> = []
    const cache = createFakeCache({
      write: request => {
        writes.push(request)
        return Promise.resolve({ kind: 'success', value: undefined })
      },
    })

    const metadata = createSelfUpdateMetadata({
      expiresAtMs: NOW + 60_000,
      facts,
      fetchedAtMs: NOW,
      targetVersion: '1.1.0',
    })
    await writeSelfUpdateMetadata({ cache, metadata, signal: new AbortController().signal })

    expect(writes).toEqual([
      {
        expiresAtMs: metadata.expiresAtMs,
        key: getSelfUpdateMetadataCacheKey(facts),
        signal: expect.any(AbortSignal),
        value: metadata,
      },
    ])
  })

  it('records metadata only when an explicit plan resolves an installable target', async () => {
    const writes: Array<{ expiresAtMs?: number; key: string; value: unknown }> = []
    const cache = createFakeCache({
      write: request => {
        writes.push(request)
        return Promise.resolve({ kind: 'success', value: undefined })
      },
    })

    await planSelfUpgrade({
      facts,
      metadataCache: cache,
      metadataTtlMs: 60_000,
      nowMs: NOW,
      target: { packageTag: 'latest', targetVersion: '1.1.0' },
    })

    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      expiresAtMs: NOW + 60_000,
      key: getSelfUpdateMetadataCacheKey(facts),
      value: { targetVersion: '1.1.0' },
    })
  })
})

describe('createVersionCachePort', () => {
  const directories: string[] = []

  afterEach(async () => {
    const { rm } = await import('node:fs/promises')
    await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })))
  })

  it('round-trips unknown values through the existing versions cache document', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qtx-version-cache-'))
    directories.push(directory)
    const filePath = join(directory, 'versions.json')
    const cache = createVersionCachePort({ filePath, getCacheMode: () => 'default', now: () => NOW })
    const signal = new AbortController().signal

    await expect(
      cache.write({ expiresAtMs: NOW + 60_000, key: 'self:update', signal, value: { version: '1.1.0' } }),
    ).resolves.toEqual({ kind: 'success', value: undefined })
    await expect(cache.read({ key: 'self:update', signal })).resolves.toEqual({
      kind: 'success',
      value: { expiresAtMs: NOW + 60_000, kind: 'hit', value: { version: '1.1.0' } },
    })

    expect(JSON.parse(await readFile(filePath, 'utf8'))).toMatchObject({
      entries: {
        'self:update': {
          body: '{"version":"1.1.0"}',
          expiresAt: NOW + 60_000,
        },
      },
    })
  })

  it('returns an expired entry as a miss without rewriting the cache file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qtx-version-cache-'))
    directories.push(directory)
    const filePath = join(directory, 'versions.json')
    let now = NOW
    const cache = createVersionCachePort({ filePath, getCacheMode: () => 'default', now: () => now })
    const signal = new AbortController().signal
    await cache.write({ expiresAtMs: NOW + 1, key: 'self:update', signal, value: { version: '1.1.0' } })
    const before = await readFile(filePath, 'utf8')
    now += 1

    await expect(cache.read({ key: 'self:update', signal })).resolves.toEqual({
      kind: 'success',
      value: { kind: 'miss' },
    })
    expect(await readFile(filePath, 'utf8')).toBe(before)
  })

  it('does not read or create a cache document in no-cache mode', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'qtx-version-cache-'))
    directories.push(directory)
    const filePath = join(directory, 'versions.json')
    const cache = createVersionCachePort({ filePath, getCacheMode: () => 'no-cache', now: () => NOW })
    const signal = new AbortController().signal

    await expect(cache.read({ key: 'self:update', signal })).resolves.toEqual({
      kind: 'success',
      value: { kind: 'miss' },
    })
    await expect(
      cache.write({ expiresAtMs: NOW + 60_000, key: 'self:update', signal, value: { version: '1.1.0' } }),
    ).resolves.toEqual({ kind: 'success', value: undefined })

    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

function createFakeCache(overrides: Partial<CachePort> = {}): CachePort {
  return {
    read: request => overrides.read?.(request) ?? success({ kind: 'miss' }),
    remove: request => overrides.remove?.(request) ?? success(undefined),
    write: request => overrides.write?.(request) ?? success(undefined),
  }
}

function success<T>(value: T): Promise<RuntimeOutcome<T>> {
  return Promise.resolve({ kind: 'success', value })
}
