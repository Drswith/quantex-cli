import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn
const originalFetch = globalThis.fetch
const mockFetch = vi.fn()

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
  globalThis.fetch = mockFetch as any
})

afterEach(() => {
  Bun.spawn = originalSpawn
  globalThis.fetch = originalFetch
  mockSpawn.mockClear()
  mockFetch.mockClear()
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    })
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
