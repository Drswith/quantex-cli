import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../src/config'
import { getSelfState, getStateFilePath, getStateLockPath, loadState, saveState, setSelfInstallSource } from '../src/state'
import { acquireResourceLock } from '../src/utils/lock'

const tempHome = join(tmpdir(), `quantex-state-test-${Date.now()}`)
const tempDir = join(tempHome, '.quantex')
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')

afterAll(() => {
  getConfigDirSpy.mockRestore()
})

describe('state helpers', () => {
  beforeEach(() => {
    getConfigDirSpy.mockReturnValue(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir))
      rmSync(tempDir, { recursive: true, force: true })
  })

  it('loads legacy state files without a self section', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(stateFilePath, `${JSON.stringify({
      installedAgents: {
        codex: {
          agentName: 'codex',
          installType: 'bun',
        },
      },
    }, null, 2)}\n`)

    const state = await loadState()

    expect(state.installedAgents.codex?.installType).toBe('bun')
    expect(state.self).toEqual({})
  })

  it('persists the self install source', async () => {
    await setSelfInstallSource('binary')

    expect(await getSelfState()).toEqual({
      installSource: 'binary',
    })

    const writtenState = JSON.parse(readFileSync(getStateFilePath(), 'utf8'))
    expect(writtenState.self?.installSource).toBe('binary')
  })

  it('rejects writes while the state lock is already held', async () => {
    const release = await acquireResourceLock({
      resource: 'state',
      scope: ['state'],
    })

    await expect(saveState({
      installedAgents: {},
      self: {},
    })).rejects.toMatchObject({
      lockPath: getStateLockPath(),
      name: 'ResourceLockError',
      resource: 'state',
    })

    await release()
  })
})
