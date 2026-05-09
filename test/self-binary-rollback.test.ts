import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fsMocks = vi.hoisted(() => ({
  renameCalls: 0,
  failOnSecondRename: false,
  bakRmCalls: 0,
  failSecondNonRecursiveBakRm: false,
}))

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rename: async (from: Parameters<typeof actual.rename>[0], to: Parameters<typeof actual.rename>[1]) => {
      fsMocks.renameCalls += 1
      if (fsMocks.failOnSecondRename && fsMocks.renameCalls === 2) {
        throw Object.assign(new Error('permission denied'), { code: 'EPERM' })
      }
      return actual.rename(from, to)
    },
    rm: async (path: Parameters<typeof actual.rm>[0], options?: Parameters<typeof actual.rm>[1]) => {
      const str = String(path)
      const recursive = options && typeof options === 'object' && 'recursive' in options ? options.recursive : undefined
      if (fsMocks.failSecondNonRecursiveBakRm && str.endsWith('.bak') && recursive !== true) {
        fsMocks.bakRmCalls += 1
        if (fsMocks.bakRmCalls === 2) {
          throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
        }
      }
      return actual.rm(path, options)
    },
  }
})

import { upgradeStandaloneBinary } from '../src/self/binary'

const originalFetch = globalThis.fetch
const originalPlatform = process.platform
const originalSpawn = Bun.spawn
const encoder = new TextEncoder()

afterEach(() => {
  globalThis.fetch = originalFetch
  Bun.spawn = originalSpawn
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  fsMocks.renameCalls = 0
  fsMocks.failOnSecondRename = false
  fsMocks.bakRmCalls = 0
  fsMocks.failSecondNonRecursiveBakRm = false
})

describe('upgradeStandaloneBinary rollback after backup swap', () => {
  it('restores the previous executable when the install rename fails after backup', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-rename-fail-'))
    const executablePath = join(tempRoot, 'qtx')

    Object.defineProperty(process, 'platform', { value: 'linux' })
    fsMocks.failOnSecondRename = true

    await writeFile(executablePath, 'old-binary', 'utf8')
    await chmod(executablePath, 0o755)

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update('new-binary').digest('hex')

    try {
      const result = await upgradeStandaloneBinary('https://example.com/qtx', executablePath, checksum)

      expect(result.success).toBe(false)
      expect(result.error?.kind).toBe('permission')
      expect(await readFile(executablePath, 'utf8')).toBe('old-binary')
      expect(existsSync(`${executablePath}.bak`)).toBe(false)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('keeps the verified new executable when backup removal fails', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-bak-rm-fail-'))
    const executablePath = join(tempRoot, 'qtx')
    const replacement = '#!/bin/sh\necho 1.1.0\n'

    Object.defineProperty(process, 'platform', { value: 'linux' })
    fsMocks.failSecondNonRecursiveBakRm = true

    Bun.spawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(0),
      stdout: createByteStream('1.1.0\n'),
    }) as typeof Bun.spawn

    await writeFile(executablePath, '#!/bin/sh\necho old\n', 'utf8')
    await chmod(executablePath, 0o755)

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(Buffer.from(replacement), { status: 200 })) as unknown as typeof fetch
    const checksum = createHash('sha256').update(replacement).digest('hex')

    try {
      const result = await upgradeStandaloneBinary('https://example.com/qtx', executablePath, checksum, '1.1.0')

      expect(result.success).toBe(false)
      expect(result.error?.kind).toBe('permission')
      expect(await readFile(executablePath, 'utf8')).toBe(replacement)
      expect(existsSync(`${executablePath}.bak`)).toBe(true)
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
