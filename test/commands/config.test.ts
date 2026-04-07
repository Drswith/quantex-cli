import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import { configCommand } from '../../src/commands/config'
import * as config from '../../src/config'

const tempDir = join(tmpdir(), `silver-test-${Date.now()}`)
const getConfigDirSpy = jest.spyOn(config, 'getConfigDir').mockReturnValue(tempDir)
const loadConfigSpy = jest.spyOn(config, 'loadConfig')

afterAll(() => {
  getConfigDirSpy.mockRestore()
  loadConfigSpy.mockRestore()
})

describe('configCommand', () => {
  let logSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true })
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    loadConfigSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('shows current config when no action', async () => {
    loadConfigSpy.mockResolvedValue({ defaultPackageManager: 'bun' })
    await configCommand()
    expect(loadConfigSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration'))
  })

  it('gets a specific config key', async () => {
    loadConfigSpy.mockResolvedValue({ defaultPackageManager: 'bun' })
    await configCommand('get', 'defaultPackageManager')
    expect(logSpy).toHaveBeenCalledWith('bun')
  })

  it('shows not set for missing key', async () => {
    loadConfigSpy.mockResolvedValue({ defaultPackageManager: 'bun' })
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
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reset to defaults'))
  })

  it('shows error for unknown action', async () => {
    await configCommand('badaction')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action'))
  })
})
