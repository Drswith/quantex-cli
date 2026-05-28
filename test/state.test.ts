import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../src/config'
import {
  getSelfState,
  getStateFilePath,
  getStateLockPath,
  loadState,
  saveState,
  setSelfInstallSource,
  setSelfUpdateNoticeState,
  StateFileError,
} from '../src/state'
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
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true })
  })

  it('loads legacy state files without a self section', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(
      stateFilePath,
      `${JSON.stringify(
        {
          installedAgents: {
            codex: {
              agentName: 'codex',
              installType: 'bun',
            },
          },
        },
        null,
        2,
      )}\n`,
    )

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

  it('persists self update notice throttle metadata', async () => {
    await saveState({
      installedAgents: {},
      self: {},
    })

    await setSelfUpdateNoticeState('1.2.0', '2026-05-01T00:00:00.000Z')

    expect(await getSelfState()).toEqual({
      updateNoticeAt: '2026-05-01T00:00:00.000Z',
      updateNoticeVersion: '1.2.0',
    })

    const writtenState = JSON.parse(readFileSync(getStateFilePath(), 'utf8'))
    expect(writtenState.self?.updateNoticeVersion).toBe('1.2.0')
    expect(writtenState.self?.updateNoticeAt).toBe('2026-05-01T00:00:00.000Z')
  })

  it('preserves unknown self keys across mutateState write-backs', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(
      stateFilePath,
      `${JSON.stringify(
        {
          installedAgents: {},
          self: {
            experimentalFlag: true,
            installSource: 'npm',
          },
        },
        null,
        2,
      )}\n`,
    )

    await setSelfUpdateNoticeState('9.9.9', '2026-05-04T12:00:00.000Z')

    const writtenState = JSON.parse(readFileSync(stateFilePath, 'utf8'))
    expect(writtenState.self?.experimentalFlag).toBe(true)
    expect(writtenState.self?.installSource).toBe('npm')
    expect(writtenState.self?.updateNoticeVersion).toBe('9.9.9')
    expect(writtenState.self?.updateNoticeAt).toBe('2026-05-04T12:00:00.000Z')
  })

  it('normalizes known self keys while preserving unknown self keys', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(
      stateFilePath,
      `${JSON.stringify(
        {
          installedAgents: {},
          self: {
            experimentalFlag: true,
            installSource: 'invalid',
            updateNoticeAt: 123,
            updateNoticeVersion: false,
          },
        },
        null,
        2,
      )}\n`,
    )

    await setSelfUpdateNoticeState('9.9.9', '2026-05-04T12:00:00.000Z')

    const writtenState = JSON.parse(readFileSync(stateFilePath, 'utf8'))
    expect(writtenState.self?.experimentalFlag).toBe(true)
    expect(writtenState.self?.installSource).toBeUndefined()
    expect(writtenState.self?.updateNoticeVersion).toBe('9.9.9')
    expect(writtenState.self?.updateNoticeAt).toBe('2026-05-04T12:00:00.000Z')
  })

  it('rejects reads when state.json contains an unknown installType', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(
      stateFilePath,
      `${JSON.stringify(
        {
          installedAgents: {
            codex: {
              agentName: 'codex',
              installType: 'not-a-real-type',
            },
          },
          self: {},
        },
        null,
        2,
      )}\n`,
    )

    await expect(loadState()).rejects.toBeInstanceOf(StateFileError)
    await expect(setSelfUpdateNoticeState('1.0.0', '2026-05-27T00:00:00.000Z')).rejects.toBeInstanceOf(StateFileError)
    expect(readFileSync(stateFilePath, 'utf8')).toContain('not-a-real-type')
  })

  it('rejects reads when installedAgents is not an object', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(
      stateFilePath,
      `${JSON.stringify(
        {
          installedAgents: [],
          self: {},
        },
        null,
        2,
      )}\n`,
    )

    await expect(loadState()).rejects.toBeInstanceOf(StateFileError)
  })

  it('rejects mutations when state.json contains invalid JSON', async () => {
    const stateFilePath = getStateFilePath()
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(stateFilePath, '{not-json', 'utf8')

    await expect(setSelfUpdateNoticeState('1.0.0', '2026-05-27T00:00:00.000Z')).rejects.toBeInstanceOf(StateFileError)
    expect(readFileSync(stateFilePath, 'utf8')).toBe('{not-json')
  })

  it('writes state.json atomically without leaving temporary files behind', async () => {
    await saveState({
      installedAgents: {},
      self: {
        installSource: 'npm',
      },
    })

    expect(readdirSync(tempDir).some(name => name.includes('.tmp-'))).toBe(false)
    expect(JSON.parse(readFileSync(getStateFilePath(), 'utf8')).self?.installSource).toBe('npm')
  })

  it('rejects writes while the state lock is already held', async () => {
    const release = await acquireResourceLock({
      resource: 'state',
      scope: ['state'],
    })

    await expect(
      saveState({
        installedAgents: {},
        self: {},
      }),
    ).rejects.toMatchObject({
      lockPath: getStateLockPath(),
      name: 'ResourceLockError',
      resource: 'state',
    })

    await release()
  })
})
