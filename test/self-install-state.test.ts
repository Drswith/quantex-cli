import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectPackageManagerSelfInstallSource,
  getStateFilePathFromEnv,
  persistDetectedPackageManagerInstallSource,
  persistSelfInstallSourceToState,
} from '../src/self/install-state'

const tempHome = join(tmpdir(), `quantex-self-install-state-${Date.now()}`)
const tempDir = join(tempHome, '.quantex')

afterEach(() => {
  if (existsSync(tempDir))
    rmSync(tempDir, { recursive: true, force: true })
})

describe('self install state helpers', () => {
  it('detects bun from global package manager env', () => {
    expect(detectPackageManagerSelfInstallSource({
      HOME: tempHome,
      npm_config_global: 'true',
      npm_config_user_agent: 'bun/1.3.11 npm/? node/?',
    })).toBe('bun')
  })

  it('detects npm from global package manager env', () => {
    expect(detectPackageManagerSelfInstallSource({
      HOME: tempHome,
      npm_config_location: 'global',
      npm_config_user_agent: 'npm/10.9.0 node/v22.0.0 darwin arm64',
    })).toBe('npm')
  })

  it('ignores non-global package installs', () => {
    expect(detectPackageManagerSelfInstallSource({
      HOME: tempHome,
      npm_config_global: 'false',
      npm_config_user_agent: 'bun/1.3.11 npm/? node/?',
    })).toBeUndefined()
  })

  it('persists a detected package manager install source', async () => {
    const env = {
      HOME: tempHome,
      npm_config_global: 'true',
      npm_config_user_agent: 'bun/1.3.11 npm/? node/?',
    }

    await expect(persistDetectedPackageManagerInstallSource(env)).resolves.toBe(true)

    const state = JSON.parse(readFileSync(getStateFilePathFromEnv(env), 'utf8'))
    expect(state.self?.installSource).toBe('bun')
    expect(state.installedAgents).toEqual({})
  })

  it('merges self install source into an existing state file', async () => {
    const env = { HOME: tempHome }
    await persistSelfInstallSourceToState('binary', env)
    await persistSelfInstallSourceToState('npm', env)

    const state = JSON.parse(readFileSync(getStateFilePathFromEnv(env), 'utf8'))
    expect(state.self?.installSource).toBe('npm')
    expect(state.installedAgents).toEqual({})
  })
})
