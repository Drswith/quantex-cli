import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

  it('removes stale lock directories without live owner processes', async () => {
    const lockPath = getResourceLockPath(['agent-lifecycle'])
    mkdirSync(lockPath, { recursive: true })
    writeFileSync(join(lockPath, 'owner.json'), `${JSON.stringify({ pid: 9_999_999 })}\n`, 'utf8')

    const release = await acquireResourceLock({
      resource: 'agent lifecycle',
      scope: ['agent-lifecycle'],
    })

    expect(existsSync(join(lockPath, 'owner.json'))).toBe(true)

    await release()
  })

  it('removes legacy empty lock directories as stale locks', async () => {
    const lockPath = getResourceLockPath(['agent-lifecycle'])
    mkdirSync(lockPath, { recursive: true })

    const release = await acquireResourceLock({
      resource: 'agent lifecycle',
      scope: ['agent-lifecycle'],
    })

    expect(existsSync(join(lockPath, 'owner.json'))).toBe(true)

    await release()
  })
})
