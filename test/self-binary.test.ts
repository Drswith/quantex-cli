import { Buffer } from 'node:buffer'
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { upgradeStandaloneBinary } from '../src/self/binary'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('upgradeStandaloneBinary', () => {
  it('downloads and replaces the current executable', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'quantex-binary-'))
    const executablePath = join(tempRoot, 'qtx')

    await writeFile(executablePath, 'old-binary', 'utf8')
    await chmod(executablePath, 0o755)

    globalThis.fetch = vi.fn().mockResolvedValue(new Response(Buffer.from('new-binary'), { status: 200 })) as unknown as typeof fetch

    try {
      expect(await upgradeStandaloneBinary('https://example.com/qtx', executablePath)).toBe(true)
      expect((await readFile(executablePath, 'utf8'))).toBe('new-binary')
      expect(((await stat(executablePath)).mode & 0o111) > 0).toBe(true)
    }
    finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
