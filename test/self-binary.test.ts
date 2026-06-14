import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWindowsStandaloneBinaryPeerPath, upgradeStandaloneBinary } from '../src/self/binary'

const originalFetch = globalThis.fetch
const originalPlatform = process.platform
const originalArch = process.arch
const originalSpawn = Bun.spawn
const encoder = new TextEncoder()

afterEach(() => {
  globalThis.fetch = originalFetch
  Bun.spawn = originalSpawn
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  Object.defineProperty(process, 'arch', { value: originalArch })
  vi.restoreAllMocks()
})

function expectExecutableBits(mode: number): void {
  if (originalPlatform === 'win32') return

  expect(mode & 0o111).toBeGreaterThan(0)
}

describe('upgradeStandaloneBinary', () => {
  it('schedules delayed replacement on Windows', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-win-'))
    const executablePath = join(tempRoot, 'qtx.exe')
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      unref: vi.fn(),
    })

    Bun.spawn = mockSpawn as typeof Bun.spawn
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
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
      const peerPath = getWindowsStandaloneBinaryPeerPath(executablePath)
      expect(peerPath).toBeTruthy()
      expect(command[command.length - 1]).toContain(`$peerPath = '${peerPath!.replaceAll("'", "''")}'`)
      expect(command[command.length - 1]).toContain('Copy-Item -LiteralPath $targetPath -Destination $peerPath -Force')
      expect(options).toMatchObject({
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
      })
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('restores the backup when the Windows delayed swap move fails', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-win-swap-rollback-'))
    const executablePath = join(tempRoot, 'qtx.exe')
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      unref: vi.fn(),
    })

    Bun.spawn = mockSpawn as typeof Bun.spawn
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx.exe', executablePath, checksum)).toEqual({
        success: true,
      })

      const [command] = mockSpawn.mock.calls[0] as [string[], Record<string, unknown>]
      const script = command[command.length - 1] as string
      expect(script).toContain('try {')
      expect(script).toContain('Move-Item -LiteralPath $tempPath -Destination $targetPath -Force')
      expect(script).toContain(
        'Move-Item -LiteralPath $backupPath -Destination $targetPath -Force -ErrorAction SilentlyContinue',
      )
      const swapTryIndex = script.indexOf('try {')
      const swapRollbackIndex = script.indexOf(
        'Move-Item -LiteralPath $backupPath -Destination $targetPath -Force -ErrorAction SilentlyContinue',
      )
      const verifyIndex = script.indexOf('& $targetPath --version')
      expect(swapTryIndex).toBeGreaterThan(-1)
      expect(swapRollbackIndex).toBeGreaterThan(swapTryIndex)
      expect(verifyIndex).toBeGreaterThan(swapRollbackIndex)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('aborts Windows delayed replacement when backup creation never succeeds', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-win-backup-'))
    const executablePath = join(tempRoot, 'qtx.exe')
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      unref: vi.fn(),
    })

    Bun.spawn = mockSpawn as typeof Bun.spawn
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx.exe', executablePath, checksum)).toEqual({
        success: true,
      })

      const [command] = mockSpawn.mock.calls[0] as [string[], Record<string, unknown>]
      const script = command[command.length - 1] as string
      expect(script).toContain('$backupReady = $false')
      expect(script).toContain('$backupReady = $true')
      expect(script).toContain('if (-not $backupReady)')
      expect(script).toContain('exit 1')
      const backupGuardIndex = script.indexOf('if (-not $backupReady)')
      const swapIndex = script.indexOf('Move-Item -LiteralPath $tempPath -Destination $targetPath -Force')
      expect(backupGuardIndex).toBeGreaterThan(-1)
      expect(swapIndex).toBeGreaterThan(backupGuardIndex)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('schedules peer alias replacement when launched from quantex.exe on Windows', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-win-long-'))
    const executablePath = join(tempRoot, 'quantex.exe')
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      unref: vi.fn(),
    })

    Bun.spawn = mockSpawn as typeof Bun.spawn
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/quantex.exe', executablePath, checksum)).toEqual({
        success: true,
      })

      const [command] = mockSpawn.mock.calls[0] as [string[], Record<string, unknown>]
      const peerPath = getWindowsStandaloneBinaryPeerPath(executablePath)
      expect(peerPath).toBeTruthy()
      expect(command[command.length - 1]).toContain(`$peerPath = '${peerPath!.replaceAll("'", "''")}'`)
      expect(command[command.length - 1]).toContain('Copy-Item -LiteralPath $targetPath -Destination $peerPath -Force')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('does not infer a peer alias for custom Windows executable names', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-win-custom-'))
    const executablePath = join(tempRoot, 'custom.exe')
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      unref: vi.fn(),
    })

    Bun.spawn = mockSpawn as typeof Bun.spawn
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/custom.exe', executablePath, checksum)).toEqual({
        success: true,
      })

      const [command] = mockSpawn.mock.calls[0] as [string[], Record<string, unknown>]
      expect(command[command.length - 1]).toContain(`$peerPath = ''`)
      expect(command[command.length - 1]).toContain("if ($peerPath -ne '')")
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('derives Windows standalone peer aliases only for known entry point names', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })

    expect(getWindowsStandaloneBinaryPeerPath('C:\\Users\\test\\.local\\bin\\qtx.exe')).toBe(
      'C:\\Users\\test\\.local\\bin\\quantex.exe',
    )
    expect(getWindowsStandaloneBinaryPeerPath('C:\\Users\\test\\.local\\bin\\quantex.exe')).toBe(
      'C:\\Users\\test\\.local\\bin\\qtx.exe',
    )
    expect(getWindowsStandaloneBinaryPeerPath('C:\\Users\\test\\.local\\bin\\custom.exe')).toBeUndefined()
  })

  it('downloads and replaces the current executable', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-'))
    const executablePath = join(tempRoot, 'qtx')

    Object.defineProperty(process, 'platform', { value: 'linux' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    await chmod(executablePath, 0o755)

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx', executablePath, checksum)).toEqual({
        success: true,
      })
      expect(await readFile(executablePath, 'utf8')).toBe('new-binary')
      expectExecutableBits((await stat(executablePath)).mode)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('verifies the replaced executable and removes the backup on success', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-verify-success-'))
    const executablePath = join(tempRoot, 'qtx')
    const replacement = '#!/bin/sh\necho 1.1.0\n'
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      stdout: createByteStream('1.1.0\n'),
    })

    Object.defineProperty(process, 'platform', { value: 'linux' })

    await writeFile(executablePath, '#!/bin/sh\necho old\n', 'utf8')
    await chmod(executablePath, 0o755)

    Bun.spawn = mockSpawn as typeof Bun.spawn
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from(replacement), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update(replacement).digest('hex')

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx', executablePath, checksum, '1.1.0')).toEqual({
        success: true,
      })
      expect(await readFile(executablePath, 'utf8')).toBe(replacement)
      expectExecutableBits((await stat(executablePath)).mode)
      expect(existsSync(`${executablePath}.bak`)).toBe(false)
    } finally {
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

    Object.defineProperty(process, 'platform', { value: 'linux' })

    await writeFile(executablePath, 'old-binary', 'utf8')
    await chmod(executablePath, 0o755)
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch

    try {
      const result = await upgradeStandaloneBinary('https://example.com/qtx', executablePath, 'deadbeef')

      expect(result.success).toBe(false)
      expect(result.error?.kind).toBe('checksum')
      expect(await readFile(executablePath, 'utf8')).toBe('old-binary')
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('rolls back to the previous executable when verification fails', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-verify-fail-'))
    const executablePath = join(tempRoot, 'qtx')
    const original = '#!/bin/sh\necho old\n'
    const replacement = '#!/bin/sh\nexit 1\n'
    const mockSpawn = vi.fn().mockReturnValue({
      exitCode: 1,
      exited: Promise.resolve(1),
      stdout: createByteStream(''),
    })

    Object.defineProperty(process, 'platform', { value: 'linux' })

    await writeFile(executablePath, original, 'utf8')
    await chmod(executablePath, 0o755)
    Bun.spawn = mockSpawn as typeof Bun.spawn
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from(replacement), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update(replacement).digest('hex')

    try {
      const result = await upgradeStandaloneBinary('https://example.com/qtx', executablePath, checksum, '1.1.0')

      expect(result.success).toBe(false)
      expect(result.error?.kind).toBe('verify')
      expect(await readFile(executablePath, 'utf8')).toBe(original)
      expect(existsSync(`${executablePath}.bak`)).toBe(false)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})

function createByteStream(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(content))
      controller.close()
    },
  })
}
