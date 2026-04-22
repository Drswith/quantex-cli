import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { upgradeStandaloneBinary } from '../src/self/binary'

const originalFetch = globalThis.fetch
const originalPlatform = process.platform
const originalSpawn = Bun.spawn

afterEach(() => {
  globalThis.fetch = originalFetch
  Bun.spawn = originalSpawn
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  vi.restoreAllMocks()
})

describe('upgradeStandaloneBinary', () => {
  it('schedules delayed replacement on Windows', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-win-'))
    const executablePath = join(tempRoot, 'qtx.exe')
    const mockSpawn = vi.fn().mockReturnValue({
      unref: vi.fn(),
    })

    Bun.spawn = mockSpawn as typeof Bun.spawn
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx.exe', executablePath, checksum)).toEqual({
        success: true,
      })

      const [command, options] = mockSpawn.mock.calls[0] as [string[], Record<string, unknown>]
      expect(command[0]).toBe('powershell.exe')
      expect(command).toContain('-Command')
      expect(command[command.length - 1]).toContain('Move-Item -LiteralPath')
      expect(command[command.length - 1]).toContain('qtx.exe')
      expect(options).toMatchObject({
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
      })
    }
    finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('downloads and replaces the current executable', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-'))
    const executablePath = join(tempRoot, 'qtx')

    await writeFile(executablePath, 'old-binary', 'utf8')
    await chmod(executablePath, 0o755)

    globalThis.fetch = vi.fn().mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx', executablePath, checksum)).toEqual({
        success: true,
      })
      expect((await readFile(executablePath, 'utf8'))).toBe('new-binary')
      expect(((await stat(executablePath)).mode & 0o111) > 0).toBe(true)
    }
    finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('returns a network error when the download request fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch

    const result = await upgradeStandaloneBinary('https://example.com/qtx', '/tmp/qtx', 'abc')

    expect(result.success).toBe(false)
    expect(result.error?.kind).toBe('network')
  })

  it('returns a checksum error and does not replace the executable when the checksum mismatches', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-checksum-'))
    const executablePath = join(tempRoot, 'qtx')

    await writeFile(executablePath, 'old-binary', 'utf8')
    await chmod(executablePath, 0o755)
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch

    try {
      const result = await upgradeStandaloneBinary('https://example.com/qtx', executablePath, 'deadbeef')

      expect(result.success).toBe(false)
      expect(result.error?.kind).toBe('checksum')
      expect(await readFile(executablePath, 'utf8')).toBe('old-binary')
    }
    finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
