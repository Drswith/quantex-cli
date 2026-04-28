import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../../src/config'
import { acquireResourceLock, getResourceLockPath } from '../../src/utils/lock'

const tempDir = join(tmpdir(), `quantex-lock-test-${Date.now()}`)
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')

afterAll(() => {
  getConfigDirSpy.mockRestore()
})

describe('resource locks', () => {
  beforeEach(() => {
    getConfigDirSpy.mockReturnValue(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { force: true, recursive: true })
  })

  it('throws a stable conflict error when the same lock is already held', async () => {
    const release = await acquireResourceLock({
      resource: 'agent lifecycle',
      scope: ['agent-lifecycle'],
    })

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

    await release()
  })
})
