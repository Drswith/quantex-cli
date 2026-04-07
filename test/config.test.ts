import { describe, expect, it, vi } from 'vitest'

vi.mock('c12', () => ({
  loadConfig: vi.fn(() => Promise.resolve({
    config: { defaultPackageManager: 'bun' },
  })),
}))

describe('defaultConfig', () => {
  it('has defaultPackageManager set to bun', async () => {
    const { defaultConfig } = await import('../src/config/default')
    expect(defaultConfig.defaultPackageManager).toBe('bun')
  })
})

describe('getConfigDir', () => {
  it('returns path ending with .silver', async () => {
    const { getConfigDir } = await import('../src/config/index')
    const dir = getConfigDir()
    expect(dir.endsWith('.silver')).toBe(true)
  })
})

describe('loadConfig', () => {
  it('returns config with defaultPackageManager', async () => {
    const { loadConfig } = await import('../src/config/index')
    const config = await loadConfig()
    expect(config.defaultPackageManager).toBe('bun')
  })
})
