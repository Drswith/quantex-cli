import { describe, expect, it, vi } from 'vitest'

vi.mock('c12', () => ({
  loadConfig: vi.fn(() =>
    Promise.resolve({
      config: {
        defaultPackageManager: 'bun',
        npmBunUpdateStrategy: 'latest-major',
      },
    }),
  ),
}))

describe('defaultConfig', () => {
  it('has defaultPackageManager set to bun', async () => {
    const { defaultConfig } = await import('../src/config/default')
    expect(defaultConfig.defaultPackageManager).toBe('bun')
    expect(defaultConfig.networkRetries).toBe(2)
    expect(defaultConfig.networkTimeoutMs).toBe(10000)
    expect(defaultConfig.npmBunUpdateStrategy).toBe('latest-major')
    expect(defaultConfig.selfUpdateChannel).toBe('stable')
    expect(defaultConfig.versionCacheTtlHours).toBe(6)
  })
})

describe('getConfigDir', () => {
  it('returns path ending with .quantex', async () => {
    const { getConfigDir } = await import('../src/config/index')
    const dir = getConfigDir()
    expect(dir.endsWith('.quantex')).toBe(true)
  })
})

describe('loadConfig', () => {
  it('returns config with normalized defaults', async () => {
    const { loadConfig } = await import('../src/config/index')
    const config = await loadConfig()
    expect(config.defaultPackageManager).toBe('bun')
    expect(config.networkRetries).toBe(2)
    expect(config.networkTimeoutMs).toBe(10000)
    expect(config.npmBunUpdateStrategy).toBe('latest-major')
    expect(config.selfUpdateChannel).toBe('stable')
    expect(config.versionCacheTtlHours).toBe(6)
  })
})
