import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configCommand } from '../../src/commands/config'
import * as config from '../../src/config'

const tempHome = join(tmpdir(), `quantex-test-${Date.now()}`)
const tempDir = join(tempHome, '.quantex')
const loadConfigSpy = vi.spyOn(config, 'loadConfig')
const originalHome = process.env.HOME
const originalUserProfile = process.env.USERPROFILE
const originalHomeDrive = process.env.HOMEDRIVE
const originalHomePath = process.env.HOMEPATH

afterAll(() => {
  loadConfigSpy.mockRestore()
  process.env.HOME = originalHome
  process.env.USERPROFILE = originalUserProfile
  process.env.HOMEDRIVE = originalHomeDrive
  process.env.HOMEPATH = originalHomePath
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
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('shows current config when no action', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      npmBunUpdateStrategy: 'latest-major',
    })
    await configCommand()
    expect(loadConfigSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration'))
  })

  it('gets a specific config key', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      npmBunUpdateStrategy: 'latest-major',
    })
    await configCommand('get', 'defaultPackageManager')
    expect(logSpy).toHaveBeenCalledWith('bun')
  })

  it('shows not set for missing key', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      npmBunUpdateStrategy: 'latest-major',
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
    expect(content.npmBunUpdateStrategy).toBe('latest-major')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reset to defaults'))
  })

  it('sets npmBunUpdateStrategy', async () => {
    loadConfigSpy.mockResolvedValue({
      defaultPackageManager: 'bun',
      npmBunUpdateStrategy: 'latest-major',
    })
    await configCommand('set', 'npmBunUpdateStrategy', 'respect-semver')
    const configPath = join(tempDir, 'config.json')
    const content = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(content.npmBunUpdateStrategy).toBe('respect-semver')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Set npmBunUpdateStrategy = respect-semver'))
  })

  it('rejects invalid npmBunUpdateStrategy', async () => {
    await configCommand('set', 'npmBunUpdateStrategy', 'invalid')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('npmBunUpdateStrategy must be latest-major or respect-semver'))
    expect(existsSync(join(tempDir, 'config.json'))).toBe(false)
  })

  it('shows error for unknown action', async () => {
    await configCommand('badaction')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action'))
  })
})
