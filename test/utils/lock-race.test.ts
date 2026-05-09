import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../../src/config'

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()

  return {
    ...actual,
    writeFile: vi.fn(async () => {
      await new Promise(() => {})
    }),
  }
})

const { acquireResourceLock, getResourceLockPath } = await import('../../src/utils/lock')

const tempDir = join(tmpdir(), `quantex-lock-race-test-${Date.now()}`)
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')

afterAll(() => {
  getConfigDirSpy.mockRestore()
})

describe('resource lock acquisition race hardening', () => {
  beforeEach(() => {
    getConfigDirSpy.mockReturnValue(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { force: true, recursive: true })
    vi.restoreAllMocks()
  })

  it('acquires the first lock without waiting on async writeFile and rejects a second claimant', async () => {
    const firstAcquireResult = await Promise.race([
      acquireResourceLock({
        resource: 'agent lifecycle',
        scope: ['agent-lifecycle'],
      }).then(release => ({ release, status: 'resolved' as const })),
      new Promise<{ status: 'timed-out' }>(resolve => {
        setTimeout(() => resolve({ status: 'timed-out' }), 100)
      }),
    ])

    expect(firstAcquireResult.status).toBe('resolved')

    if (firstAcquireResult.status !== 'resolved') return

    await expect(
      acquireResourceLock({
        resource: 'agent lifecycle',
        scope: ['agent-lifecycle'],
      }),
    ).rejects.toMatchObject({
      lockPath: getResourceLockPath(['agent-lifecycle']),
      name: 'ResourceLockError',
      resource: 'agent lifecycle',
    })

    await firstAcquireResult.release()
  })
})
