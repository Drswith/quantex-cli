import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

const tempHome = join(tmpdir(), `quantex-config-test-${Date.now()}`)
const configDir = join(tempHome, '.quantex')
const configPath = join(configDir, 'config.json')
const originalHome = process.env.HOME
const originalUserProfile = process.env.USERPROFILE

afterAll(() => {
  process.env.HOME = originalHome
  process.env.USERPROFILE = originalUserProfile
})

describe('defaultConfig', () => {
  it('has defaultPackageManager set to bun', async () => {
    const { defaultConfig } = await import('../src/config/default')
    expect(defaultConfig.defaultPackageManager).toBe('bun')
    expect(defaultConfig.networkRetries).toBe(2)
    expect(defaultConfig.networkTimeoutMs).toBe(10000)
    expect(defaultConfig.npmBunUpdateStrategy).toBe('latest-major')
    expect(defaultConfig.selfUpdateChannel).toBe('stable')
    expect(defaultConfig.selfUpdateRegistry).toBeUndefined()
    expect(defaultConfig.versionCacheTtlHours).toBe(6)
  })
})

describe('getConfigDir', () => {
  it('returns path ending with .quantex', async () => {
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    const { getConfigDir } = await import('../src/config/index')
    const dir = getConfigDir()
    expect(dir.endsWith('.quantex')).toBe(true)
  })
})

describe('loadConfig', () => {
  beforeEach(() => {
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
  })

  afterEach(() => {
    process.env.HOME = originalHome
    process.env.USERPROFILE = originalUserProfile
    if (existsSync(configDir)) rmSync(configDir, { recursive: true, force: true })
  })

  it('returns config with normalized defaults', async () => {
    const { loadConfig } = await import('../src/config/index')
    const config = await loadConfig()
    expect(config.defaultPackageManager).toBe('bun')
    expect(config.networkRetries).toBe(2)
    expect(config.networkTimeoutMs).toBe(10000)
    expect(config.npmBunUpdateStrategy).toBe('latest-major')
    expect(config.selfUpdateChannel).toBe('stable')
    expect(config.selfUpdateRegistry).toBeUndefined()
    expect(config.versionCacheTtlHours).toBe(6)
  })

  it('loads and normalizes values from config.json', async () => {
    mkdirSync(configDir, { recursive: true })
    writeFileSync(
      configPath,
      `${JSON.stringify({
        defaultPackageManager: 'npm',
        networkRetries: '4',
        networkTimeoutMs: '15000',
        npmBunUpdateStrategy: 'respect-semver',
        selfUpdateChannel: 'beta',
        selfUpdateRegistry: 'https://registry.npmjs.org/',
        versionCacheTtlHours: '12',
      })}\n`,
    )

    const { loadConfig } = await import('../src/config/index')
    const config = await loadConfig()

    expect(config.defaultPackageManager).toBe('npm')
    expect(config.networkRetries).toBe(4)
    expect(config.networkTimeoutMs).toBe(15000)
    expect(config.npmBunUpdateStrategy).toBe('respect-semver')
    expect(config.selfUpdateChannel).toBe('beta')
    expect(config.selfUpdateRegistry).toBe('https://registry.npmjs.org')
    expect(config.versionCacheTtlHours).toBe(12)
  })

  it('falls back to defaults when config.json is invalid', async () => {
    mkdirSync(configDir, { recursive: true })
    writeFileSync(configPath, '{invalid json\n')

    const { loadConfig } = await import('../src/config/index')
    const config = await loadConfig()

    expect(config.defaultPackageManager).toBe('bun')
    expect(config.networkRetries).toBe(2)
    expect(config.networkTimeoutMs).toBe(10000)
    expect(config.npmBunUpdateStrategy).toBe('latest-major')
    expect(config.selfUpdateChannel).toBe('stable')
    expect(config.selfUpdateRegistry).toBeUndefined()
    expect(config.versionCacheTtlHours).toBe(6)
  })
})
