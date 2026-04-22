import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCliContext, setCliContext } from '../../src/cli-context'
import * as config from '../../src/config'

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn
const originalFetch = globalThis.fetch
const mockFetch = vi.fn()
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')
const tempConfigDir = join(tmpdir(), `quantex-version-cache-${Date.now()}`)

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
  globalThis.fetch = mockFetch as any
  getConfigDirSpy.mockReturnValue(tempConfigDir)
  loadConfigSpy.mockResolvedValue({
    defaultPackageManager: 'bun',
    networkRetries: 2,
    networkTimeoutMs: 10000,
    npmBunUpdateStrategy: 'latest-major',
    selfUpdateChannel: 'stable',
    versionCacheTtlHours: 6,
  })
})

afterEach(() => {
  Bun.spawn = originalSpawn
  globalThis.fetch = originalFetch
  mockSpawn.mockClear()
  mockFetch.mockClear()
  loadConfigSpy.mockClear()
  if (existsSync(tempConfigDir))
    rmSync(tempConfigDir, { recursive: true, force: true })
})

function createMockProcess(exitCode: number, stdout = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout))
        controller.close()
      },
    }),
    stderr: new ReadableStream(),
  }
}

describe('getInstalledVersion', () => {
  it('extracts pure version number', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, '1.2.3\n'))
    const version = await getInstalledVersion('claude')
    expect(version).toBe('1.2.3')
  })

  it('extracts version with v prefix', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, 'v1.2.3\n'))
    const version = await getInstalledVersion('cli')
    expect(version).toBe('1.2.3')
  })

  it('extracts version from name prefixed output', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, 'codex-cli 0.118.0\n'))
    const version = await getInstalledVersion('codex')
    expect(version).toBe('0.118.0')
  })

  it('extracts version from multi-line output (first line)', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, 'GitHub Copilot CLI 1.0.20.\nRun \'copilot update\' to check for updates.\n'))
    const version = await getInstalledVersion('copilot')
    expect(version).toBe('1.0.20')
  })

  it('extracts calendar version format', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, '2026.03.30-a5d3e17\n'))
    const version = await getInstalledVersion('cursor')
    expect(version).toBe('2026.03.30-a5d3e17')
  })

  it('extracts prerelease version', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, 'v1.0.0-alpha.1\n'))
    const version = await getInstalledVersion('cli')
    expect(version).toBe('1.0.0-alpha.1')
  })

  it('supports custom version probe commands', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, 'agent: 2026.03.30-a5d3e17\n'))
    const version = await getInstalledVersion('agent', {
      command: ['agent', 'version'],
    })
    expect(version).toBe('2026.03.30-a5d3e17')
    expect(mockSpawn).toHaveBeenCalledWith(['agent', 'version'], expect.any(Object))
  })

  it('supports custom version parsers', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, 'release=2026.04.01\nbuild=abc\n'))
    const version = await getInstalledVersion('agent', {
      parser: output => output.split('\n')[0]?.split('=')[1],
    })
    expect(version).toBe('2026.04.01')
  })

  it('returns undefined on non-zero exit', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(1, ''))
    const version = await getInstalledVersion('claude')
    expect(version).toBeUndefined()
  })

  it('returns undefined on spawn error', async () => {
    const { getInstalledVersion } = await import('../../src/utils/version')
    mockSpawn.mockImplementation(() => {
      throw new Error('not found')
    })
    const version = await getInstalledVersion('claude')
    expect(version).toBeUndefined()
  })
})

describe('getLatestVersion', () => {
  it('returns version from npm registry on success', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 }))
    const version = await getLatestVersion('some-package')
    expect(version).toBe('2.0.0')
  })

  it('returns undefined on failed fetch', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })
    const version = await getLatestVersion('bad-package')
    expect(version).toBeUndefined()
  })

  it('returns undefined on network error', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockRejectedValue(new Error('network error'))
    const version = await getLatestVersion('some-package')
    expect(version).toBeUndefined()
  })

  it('caches npm registry responses to disk', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: '2.0.0' }), {
      headers: { etag: '"abc"' },
      status: 200,
    }))

    expect(await getLatestVersion('some-package')).toBe('2.0.0')
    expect(await getLatestVersion('some-package')).toBe('2.0.0')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(readFileSync(join(tempConfigDir, 'cache', 'versions.json'), 'utf8')).toContain('"npm:some-package:latest"')
  })

  it('retries failed version requests before succeeding', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: '3.0.0' }), { status: 200 }))

    expect(await getLatestVersion('retry-package')).toBe('3.0.0')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('records network freshness metadata after a live fetch', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    setCliContext({
      cacheMode: 'default',
      interactive: false,
      outputMode: 'json',
      runId: 'version-run-id',
    })
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 }))

    expect(await getLatestVersion('network-package')).toBe('2.0.0')
    expect(getCliContext().freshness?.source).toBe('network')
    expect(getCliContext().freshness?.fetchedAt).toBeTruthy()
    expect(getCliContext().freshness?.staleAfter).toBeTruthy()
  })

  it('records cache freshness metadata on cache hits', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 }))

    expect(await getLatestVersion('cached-package')).toBe('2.0.0')

    setCliContext({
      cacheMode: 'default',
      interactive: false,
      outputMode: 'json',
      runId: 'cache-run-id',
    })

    expect(await getLatestVersion('cached-package')).toBe('2.0.0')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(getCliContext().freshness?.source).toBe('cache')
  })

  it('forces a network refresh when refresh mode is enabled', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 }))

    expect(await getLatestVersion('refresh-package')).toBe('2.0.0')

    setCliContext({
      cacheMode: 'refresh',
      interactive: false,
      outputMode: 'json',
      runId: 'refresh-run-id',
    })
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: '2.1.0' }), { status: 200 }))

    expect(await getLatestVersion('refresh-package')).toBe('2.1.0')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(getCliContext().freshness?.source).toBe('network')
  })

  it('bypasses cache writes when no-cache mode is enabled', async () => {
    const { getLatestVersion } = await import('../../src/utils/version')
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 }))

    expect(await getLatestVersion('no-cache-package')).toBe('2.0.0')
    const cachedFileBefore = readFileSync(join(tempConfigDir, 'cache', 'versions.json'), 'utf8')

    setCliContext({
      cacheMode: 'no-cache',
      interactive: false,
      outputMode: 'json',
      runId: 'no-cache-run-id',
    })
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: '3.0.0' }), { status: 200 }))

    expect(await getLatestVersion('no-cache-package')).toBe('3.0.0')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(readFileSync(join(tempConfigDir, 'cache', 'versions.json'), 'utf8')).toBe(cachedFileBefore)
  })
})

describe('getBinaryPath', () => {
  it('returns first line from which/where output', async () => {
    const { getBinaryPath } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(0, '/usr/local/bin/claude\n/home/user/.bun/bin/claude\n'))
    const path = await getBinaryPath('claude')
    expect(path).toBe('/usr/local/bin/claude')
  })

  it('returns undefined on failure', async () => {
    const { getBinaryPath } = await import('../../src/utils/version')
    mockSpawn.mockReturnValue(createMockProcess(1, ''))
    const path = await getBinaryPath('missing')
    expect(path).toBeUndefined()
  })
})
