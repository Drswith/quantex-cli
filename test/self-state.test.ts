import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '../src/config'
import * as state from '../src/state'
import * as version from '../src/utils/version'

const latestVersionSpy = vi.spyOn(version, 'getLatestVersion')
const getConfigDirSpy = vi.spyOn(config, 'getConfigDir')
const getSelfStateSpy = vi.spyOn(state, 'getSelfState')
const tempHome = join(tmpdir(), `quantex-self-state-test-${Date.now()}`)
const tempDir = join(tempHome, '.quantex')

afterAll(() => {
  latestVersionSpy.mockRestore()
  getConfigDirSpy.mockRestore()
  getSelfStateSpy.mockRestore()
})

describe('self state reconciliation', () => {
  beforeEach(() => {
    getConfigDirSpy.mockReturnValue(tempDir)
    latestVersionSpy.mockClear()
    latestVersionSpy.mockResolvedValue('9.9.9')
    getSelfStateSpy.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true })
  })

  it('refreshes stored self install source when runtime detection disagrees', async () => {
    const stateFilePath = join(tempDir, 'state.json')
    mkdirSync(tempDir, { recursive: true })
    await Bun.write(
      stateFilePath,
      `${JSON.stringify(
        {
          installedAgents: {},
          self: {
            installSource: 'bun',
          },
        },
        null,
        2,
      )}\n`,
    )

    const { inspectSelf } = await import('../src/self')
    const inspection = await inspectSelf()

    expect(inspection.installSource).toBe('source')
    const savedState = JSON.parse(readFileSync(stateFilePath, 'utf8'))
    expect(savedState.self?.installSource).toBe('source')
  })

  it('persists a newly detected managed self install source when state is missing', async () => {
    const { reconcileSelfInstallSource } = await import('../src/self')

    await expect(reconcileSelfInstallSource(undefined, 'npm')).resolves.toBe('npm')

    const savedState = JSON.parse(readFileSync(join(tempDir, 'state.json'), 'utf8'))
    expect(savedState.self?.installSource).toBe('npm')
  })
})
