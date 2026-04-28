import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configCommand } from '../../src/commands/config'
import * as config from '../../src/config'

const tempHome = join(tmpdir(), `quantex-test-${Date.now()}`)
const tempDir = join(tempHome, '.quantex')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')
const originalHome = process.env.HOME
const originalUserProfile = process.env.USERPROFILE

afterAll(() => {
  loadConfigSpy.mockRestore()
})

describe('configCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    loadConfigSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    process.env.HOME = originalHome
    process.env.USERPROFILE = originalUserProfile
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('shows current config when no action', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    await configCommand()
    expect(loadConfigSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration'))
  })

  it('gets a specific config key', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    await configCommand('get', 'defaultPackageManager')
    expect(logSpy).toHaveBeenCalledWith('bun')
  })

  it('shows not set for missing key', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    await configCommand('get', 'nonexistent')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not set'))
  })

  it('sets a config key', async () => {
    await configCommand('set', 'defaultPackageManager', 'npm')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.defaultPackageManager).toBe('npm')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Set defaultPackageManager = npm'))
  })

  it('resets config to defaults', async () => {
    await configCommand('reset')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.defaultPackageManager).toBe('bun')
    expect(content.networkRetries).toBe(2)
    expect(content.networkTimeoutMs).toBe(10000)
    expect(content.npmBunUpdateStrategy).toBe('latest-major')
    expect(content.selfUpdateChannel).toBe('stable')
    expect(content.selfUpdateRegistry).toBeUndefined()
    expect(content.versionCacheTtlHours).toBe(6)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reset to defaults'))
  })

  it('sets npmBunUpdateStrategy', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    await configCommand('set', 'npmBunUpdateStrategy', 'respect-semver')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.npmBunUpdateStrategy).toBe('respect-semver')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Set npmBunUpdateStrategy = respect-semver'))
  })

  it('rejects invalid npmBunUpdateStrategy', async () => {
    await configCommand('set', 'npmBunUpdateStrategy', 'invalid')
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('npmBunUpdateStrategy must be latest-major or respect-semver'),
    )
    expect(existsSync(join(tempDir, 'config.json'))).toBe(false)
  })

  it('sets selfUpdateChannel', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    await configCommand('set', 'selfUpdateChannel', 'beta')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.selfUpdateChannel).toBe('beta')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Set selfUpdateChannel = beta'))
  })

  it('sets selfUpdateRegistry', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      selfUpdateRegistry: undefined,
      versionCacheTtlHours: 6,
    })
    await configCommand('set', 'selfUpdateRegistry', 'https://registry.npmjs.org/')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.selfUpdateRegistry).toBe('https://registry.npmjs.org')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Set selfUpdateRegistry = https://registry.npmjs.org'))
  })

  it('rejects invalid selfUpdateChannel', async () => {
    await configCommand('set', 'selfUpdateChannel', 'nightly')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('selfUpdateChannel must be stable or beta'))
    expect(existsSync(join(tempDir, 'config.json'))).toBe(false)
  })

  it('rejects invalid selfUpdateRegistry', async () => {
    await configCommand('set', 'selfUpdateRegistry', 'npmjs')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('selfUpdateRegistry must be a valid absolute URL'))
    expect(existsSync(join(tempDir, 'config.json'))).toBe(false)
  })

  it('sets networkTimeoutMs', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      networkRetries: 2,
      networkTimeoutMs: 10000,
      npmBunUpdateStrategy: 'latest-major',
      selfUpdateChannel: 'stable',
      versionCacheTtlHours: 6,
    })
    await configCommand('set', 'networkTimeoutMs', '15000')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.networkTimeoutMs).toBe(15000)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Set networkTimeoutMs = 15000'))
  })

  it('rejects invalid versionCacheTtlHours', async () => {
    await configCommand('set', 'versionCacheTtlHours', '0')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('versionCacheTtlHours must be a positive integer'))
    expect(existsSync(join(tempDir, 'config.json'))).toBe(false)
  })

  it('shows error for unknown action', async () => {
    await configCommand('badaction')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action'))
  })
})
