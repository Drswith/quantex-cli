import type { Server } from 'node:http'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelCliContextOperations, resetCliContext, setCliContext } from '../../src/cli-context'
import * as config from '../../src/config'
import { createCliOperationContext } from '../../src/runtime/cli-operation-context'
import { resolveSelfUpdateTarget } from '../../src/self/planning'
import { getLatestVersion } from '../../src/utils/version'

const originalFetch = globalThis.fetch
const roots: string[] = []
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')

beforeEach(() => {
  resetCliContext()
  setCliContext({ cacheMode: 'default', interactive: false, outputMode: 'json', runId: 'network-lifecycle' })
  loadConfigSpy.mockResolvedValue({
    defaultPackageManager: 'bun',
    networkRetries: 0,
    networkTimeoutMs: 10_000,
    npmBunUpdateStrategy: 'latest-major',
    selfUpdateChannel: 'stable',
    versionCacheTtlHours: 6,
  })
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  resetCliContext()
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('network response lifecycle', () => {
  it('prioritizes an explicit invocation timeout over request transport rejection before headers', async () => {
    const fixture = await createFixture()
    const before = await snapshotTree(fixture)
    installHeaderlessAbortFetch()

    await expect(
      getLatestVersion('headerless-timeout-package', 'latest', {
        context: { signal: new AbortController().signal, timeoutMs: 20 },
      }),
    ).rejects.toMatchObject({ kind: 'timed-out', timeoutMs: 20 })
    expect(await snapshotTree(fixture)).toEqual(before)
  })

  it('prioritizes external cancellation over request transport rejection before headers', async () => {
    const fixture = await createFixture()
    const before = await snapshotTree(fixture)
    const controller = new AbortController()
    installHeaderlessAbortFetch()
    const pending = getLatestVersion('headerless-cancel-package', 'latest', {
      context: { signal: controller.signal },
    })

    controller.abort('test cancellation')

    await expect(pending).rejects.toMatchObject({ kind: 'cancelled', reason: 'test cancellation' })
    expect(await snapshotTree(fixture)).toEqual(before)
  })

  it('keeps request-before-headers internal timeout exhaustion on the legacy fallback path', async () => {
    const fixture = await createFixture()
    const before = await snapshotTree(fixture)
    installHeaderlessAbortFetch()
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 0,
      networkTimeoutMs: 20,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })

    await expect(getLatestVersion('headerless-internal-package')).resolves.toBeUndefined()
    expect(await snapshotTree(fixture)).toEqual(before)
  })

  it('cancels a slow version body through the shared invocation cleanup without changing cache state', async () => {
    const fixture = await createFixture()
    const server = await startSlowBodyServer('{"version":"')
    const operation = createCliOperationContext()
    const before = await snapshotTree(fixture)

    try {
      const pending = operation.run(() =>
        getLatestVersion('slow-package', 'latest', {
          context: operation.context,
          registry: server.url,
        }),
      )
      await server.requested
      setTimeout(() => void cancelCliContextOperations(), 100)

      await expect(withDeadline(pending, 1_000)).rejects.toMatchObject({ kind: 'cancelled' })
      await expect(withDeadline(server.cancelled, 1_000)).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      operation.dispose()
      await server.close()
    }
  })

  it('cancels a slow self-release body and preserves the complete cache tree', async () => {
    const fixture = await createFixture()
    const server = await startSlowBodyServer('{"version":"')
    const controller = new AbortController()
    const before = await snapshotTree(fixture)
    globalThis.fetch = ((_input, init) => originalFetch(server.url, init)) as typeof fetch

    try {
      const pending = resolveSelfUpdateTarget(
        {
          canAutoUpdate: true,
          currentVersion: '1.0.0',
          executablePath: '/tmp/quantex',
          installSource: 'binary',
          packageRoot: '/tmp',
          updateChannel: 'stable',
        },
        { signal: controller.signal },
      )
      await server.requested
      setTimeout(() => controller.abort('test cancellation'), 100)

      await expect(withDeadline(pending, 1_000)).rejects.toMatchObject({
        kind: 'cancelled',
        reason: 'test cancellation',
      })
      await expect(withDeadline(server.cancelled, 1_000)).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      await server.close()
    }
  })

  it('preserves typed timeout only when the invocation context has an explicit deadline', async () => {
    const fixture = await createFixture()
    const server = await startSlowBodyServer('{"version":"')
    const before = await snapshotTree(fixture)

    try {
      await expect(
        getLatestVersion('invocation-timeout-package', 'latest', {
          context: { signal: new AbortController().signal, timeoutMs: 100 },
          registry: server.url,
        }),
      ).rejects.toMatchObject({ kind: 'timed-out', timeoutMs: 100 })
      await expect(withDeadline(server.cancelled, 1_000)).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      await server.close()
    }
  })

  it('falls back after an internal slow-body timeout without committing cache or freshness metadata', async () => {
    const fixture = await createFixture()
    const server = await startSlowBodyServer('{"version":"')
    const before = await snapshotTree(fixture)
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 0,
      networkTimeoutMs: 100,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })

    try {
      const pending = getLatestVersion('slow-timeout-package', 'latest', { registry: server.url })

      await expect(withDeadline(pending, 1_000)).resolves.toBeUndefined()
      await expect(withDeadline(server.cancelled, 1_000)).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      await server.close()
    }
  })

  it('keeps the per-attempt deadline active through response validation', async () => {
    const fixture = await createFixture()
    const server = await startBodyServer('{"version":"2.0.0"}')
    const before = await snapshotTree(fixture)
    const parse = JSON.parse.bind(JSON)
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(value => {
      const deadline = Date.now() + 150
      while (Date.now() < deadline) {
        // Hold synchronous validation past the attempt deadline.
      }
      return parse(value)
    })
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 0,
      networkTimeoutMs: 100,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })

    try {
      await expect(
        getLatestVersion('slow-validation-package', 'latest', { registry: server.url }),
      ).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      parseSpy.mockRestore()
      await server.close()
    }
  })

  it('returns stale cached version data after internal timeout without rewriting the cache', async () => {
    const fixture = await createFixture()
    const server = await startSlowBodyServer('{"version":"')
    const cacheDir = join(fixture, 'cache')
    await mkdir(cacheDir, { recursive: true })
    await writeFile(
      join(cacheDir, 'versions.json'),
      `${JSON.stringify({
        entries: {
          [`npm:${server.url}:stale-package:latest`]: {
            body: JSON.stringify({ version: '7.7.7' }),
            expiresAt: Date.now() - 1,
            fetchedAt: Date.now() - 10_000,
          },
        },
      })}\n`,
    )
    const before = await snapshotTree(fixture)
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 0,
      networkTimeoutMs: 100,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })

    try {
      await expect(getLatestVersion('stale-package', 'latest', { registry: server.url })).resolves.toBe('7.7.7')
      await expect(withDeadline(server.cancelled, 1_000)).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      await server.close()
    }
  })

  it('maps an internal self-release timeout to the legacy network resolution result', async () => {
    const fixture = await createFixture()
    const server = await startSlowBodyServer('{"version":"')
    const before = await snapshotTree(fixture)
    globalThis.fetch = ((_input, init) => originalFetch(server.url, init)) as typeof fetch
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 0,
      networkTimeoutMs: 100,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })

    try {
      await expect(
        resolveSelfUpdateTarget({
          canAutoUpdate: true,
          currentVersion: '1.0.0',
          executablePath: '/tmp/quantex',
          installSource: 'binary',
          packageRoot: '/tmp',
          updateChannel: 'stable',
        }),
      ).resolves.toMatchObject({ resolutionError: { kind: 'network' } })
      await expect(withDeadline(server.cancelled, 1_000)).resolves.toBeUndefined()
      expect(await snapshotTree(fixture)).toEqual(before)
    } finally {
      await server.close()
    }
  })
})

function installHeaderlessAbortFetch(): void {
  globalThis.fetch = vi.fn(
    (_input, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('transport aborted')), { once: true })
      }),
  ) as unknown as typeof fetch
}

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'quantex-network-lifecycle-'))
  roots.push(root)
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'sentinel.txt'), 'unchanged\n')
  getConfigDirSpy.mockReturnValue(root)
  return root
}

async function startSlowBodyServer(prefix: string): Promise<{
  cancelled: Promise<void>
  close(): Promise<void>
  requested: Promise<void>
  url: string
}> {
  let markCancelled!: () => void
  let markRequested!: () => void
  const cancelled = new Promise<void>(resolve => (markCancelled = resolve))
  const requested = new Promise<void>(resolve => (markRequested = resolve))
  const server = createServer((request, response) => {
    request.once('close', markCancelled)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.write(prefix)
    markRequested()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Failed to start slow-body test server.')
  return {
    cancelled,
    close: () => closeServer(server),
    requested,
    url: `http://127.0.0.1:${address.port}`,
  }
}

async function startBodyServer(body: string): Promise<{ close(): Promise<void>; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(body)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Failed to start body test server.')
  return {
    close: () => closeServer(server),
    url: `http://127.0.0.1:${address.port}`,
  }
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
}

async function snapshotTree(root: string): Promise<Array<{ body?: string; path: string; type: 'directory' | 'file' }>> {
  const snapshot: Array<{ body?: string; path: string; type: 'directory' | 'file' }> = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const relativePath = relative(root, path)
      if (entry.isDirectory()) {
        snapshot.push({ path: relativePath, type: 'directory' })
        await visit(path)
      } else {
        snapshot.push({ body: (await readFile(path)).toString('base64'), path: relativePath, type: 'file' })
      }
    }
  }
  await visit(root)
  return snapshot.sort((left, right) => left.path.localeCompare(right.path))
}

async function withDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Network lifecycle did not settle within ${timeoutMs}ms.`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
