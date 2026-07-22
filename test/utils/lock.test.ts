import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../../src/config'
import {
  acquireResourceLock,
  acquireResourceLockInConfigDir,
  getResourceLockPath,
  getResourceLockPathInConfigDir,
  withResourceLockInConfigDir,
} from '../../src/utils/lock'

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

  it('preserves the legacy getConfigDir-derived lock path', () => {
    expect(getResourceLockPath(['agent-lifecycle', 'codex'])).toBe(
      join(tempDir, 'locks', 'agent-lifecycle', 'codex.lock'),
    )
    expect(getResourceLockPath(['agent-lifecycle', 'codex'])).toBe(
      getResourceLockPathInConfigDir(tempDir, ['agent-lifecycle', 'codex']),
    )
  })

  it('isolates the same resource scope across explicit config directories', async () => {
    const leftConfigDir = join(tempDir, 'left')
    const rightConfigDir = join(tempDir, 'right')
    const options = {
      resource: 'agent lifecycle',
      scope: ['agent-lifecycle'],
    } as const
    const leftLockPath = getResourceLockPathInConfigDir(leftConfigDir, options.scope)
    const rightLockPath = getResourceLockPathInConfigDir(rightConfigDir, options.scope)

    const releaseLeft = await acquireResourceLockInConfigDir(leftConfigDir, options)
    const releaseRight = await acquireResourceLockInConfigDir(rightConfigDir, options)

    expect(leftLockPath).not.toBe(rightLockPath)
    expect(existsSync(join(leftLockPath, 'owner.json'))).toBe(true)
    expect(existsSync(join(rightLockPath, 'owner.json'))).toBe(true)

    await expect(acquireResourceLockInConfigDir(leftConfigDir, options)).rejects.toMatchObject({
      lockPath: leftLockPath,
      name: 'ResourceLockError',
      resource: 'agent lifecycle',
    })

    await releaseLeft()
    expect(existsSync(leftLockPath)).toBe(false)
    expect(existsSync(rightLockPath)).toBe(true)

    await releaseRight()
    expect(existsSync(rightLockPath)).toBe(false)
  })

  it('releases an explicit config-directory lock when the scoped operation fails', async () => {
    const explicitConfigDir = join(tempDir, 'explicit')
    const lockPath = getResourceLockPathInConfigDir(explicitConfigDir, ['agent-lifecycle'])

    await expect(
      withResourceLockInConfigDir(
        explicitConfigDir,
        {
          resource: 'agent lifecycle',
          scope: ['agent-lifecycle'],
        },
        async () => {
          expect(existsSync(join(lockPath, 'owner.json'))).toBe(true)
          throw new Error('operation failed')
        },
      ),
    ).rejects.toThrow('operation failed')

    expect(existsSync(lockPath)).toBe(false)
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

  it('does not remove the lock directory when owner.json is unreadable', async () => {
    if (process.platform === 'win32') return

    const lockPath = getResourceLockPath(['unreadable-owner'])
    mkdirSync(lockPath, { recursive: true })
    const ownerPath = join(lockPath, 'owner.json')
    writeFileSync(ownerPath, `${JSON.stringify({ pid: process.pid })}\n`, 'utf8')
    chmodSync(ownerPath, 0o000)

    try {
      await expect(
        acquireResourceLock({
          resource: 'agent lifecycle',
          scope: ['unreadable-owner'],
        }),
      ).rejects.toMatchObject({
        name: 'ResourceLockError',
      })
      expect(existsSync(lockPath)).toBe(true)
    } finally {
      try {
        chmodSync(ownerPath, 0o644)
      } catch {
        // ignore cleanup chmod failures
      }
    }
  })

  it('does not remove the lock directory when owner.json is not valid JSON', async () => {
    const lockPath = getResourceLockPath(['invalid-json-owner'])
    mkdirSync(lockPath, { recursive: true })
    writeFileSync(join(lockPath, 'owner.json'), '{broken\n', 'utf8')

    await expect(
      acquireResourceLock({
        resource: 'agent lifecycle',
        scope: ['invalid-json-owner'],
      }),
    ).rejects.toMatchObject({
      name: 'ResourceLockError',
    })

    expect(existsSync(lockPath)).toBe(true)
  })

  it('does not delete the lock directory when owner.json appears during the acquisition grace window', async () => {
    const lockPath = getResourceLockPath(['grace-window'])
    mkdirSync(lockPath, { recursive: true })

    const writeAfterDelay = (async () => {
      await new Promise<void>(resolve => {
        setTimeout(resolve, 15)
      })
      writeFileSync(join(lockPath, 'owner.json'), `${JSON.stringify({ pid: process.pid })}\n`, 'utf8')
    })()

    await expect(
      acquireResourceLock({
        resource: 'agent lifecycle',
        scope: ['grace-window'],
      }),
    ).rejects.toMatchObject({
      name: 'ResourceLockError',
    })

    await writeAfterDelay
    expect(existsSync(lockPath)).toBe(true)
    expect(existsSync(join(lockPath, 'owner.json'))).toBe(true)
  })
})
