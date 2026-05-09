import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const renameMock = vi.hoisted(() => ({
  calls: 0,
  failOnSecondRename: false,
}))

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rename: async (from: Parameters<typeof actual.rename>[0], to: Parameters<typeof actual.rename>[1]) => {
      renameMock.calls += 1
      if (renameMock.failOnSecondRename && renameMock.calls === 2) {
        throw Object.assign(new Error('permission denied'), { code: 'EPERM' })
      }
      return actual.rename(from, to)
    },
  }
})

import { upgradeStandaloneBinary } from '../src/self/binary'

const originalFetch = globalThis.fetch
const originalPlatform = process.platform

afterEach(() => {
  globalThis.fetch = originalFetch
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  renameMock.calls = 0
  renameMock.failOnSecondRename = false
})

describe('upgradeStandaloneBinary rollback after backup swap', () => {
  it('restores the previous executable when the install rename fails after backup', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-rename-fail-'))
    const executablePath = join(tempRoot, 'qtx')

    Object.defineProperty(process, 'platform', { value: 'linux' })
    renameMock.failOnSecondRename = true

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
})
