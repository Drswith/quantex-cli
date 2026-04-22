import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { upgradeCommand } from '../../src/commands/upgrade'
import * as selfModule from '../../src/self'

const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelf')
const upgradeSelfSpy = vi.spyOn(selfModule, 'upgradeSelf')

afterAll(() => {
  inspectSelfSpy.mockRestore()
  upgradeSelfSpy.mockRestore()
})

describe('upgradeCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    inspectSelfSpy.mockClear()
    upgradeSelfSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows up to date when latest version matches current version', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.0.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await expect(upgradeCommand()).resolves.toBe(0)

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already up to date'))
  })

  it('refuses to auto-update from unsupported install sources', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: false,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'source',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      updateChannel: 'stable',
    })

    await expect(upgradeCommand()).resolves.toBe(2)

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cannot auto-update'))
  })

  it('shows manual recovery for bun installs when self-upgrade fails', async () => {
    const inspection = {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun' as const,
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable' as const,
    }
    inspectSelfSpy.mockResolvedValue(inspection)
    upgradeSelfSpy.mockResolvedValue({
      error: {
        kind: 'unknown',
        message: 'Failed to update quantex-cli through Bun.',
      },
      installSource: 'bun',
      success: false,
    })

    await expect(upgradeCommand()).resolves.toBe(2)

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to upgrade Quantex CLI'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Reason: Failed to update quantex-cli through Bun.'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('bun add -g quantex-cli@latest'))
  })

  it('shows manual recovery for npm installs when self-upgrade fails', async () => {
    const inspection = {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/qtx',
      installSource: 'npm' as const,
      latestVersion: '1.1.0',
      packageRoot: '/usr/local/lib/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable' as const,
    }
    inspectSelfSpy.mockResolvedValue(inspection)
    upgradeSelfSpy.mockResolvedValue({
      error: {
        kind: 'unknown',
        message: 'Failed to update quantex-cli through npm.',
      },
      installSource: 'npm',
      success: false,
    })

    await expect(upgradeCommand()).resolves.toBe(2)

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('npm install -g quantex-cli@latest'))
  })

  it('shows manual recovery for binary installs when self-upgrade fails', async () => {
    const executablePath = process.platform === 'win32' ? 'C:\\Program Files\\Quantex\\qtx.exe' : '/usr/local/bin/qtx'
    const inspection = {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath,
      installSource: 'binary' as const,
      latestVersion: '1.1.0',
      packageRoot: process.platform === 'win32' ? 'C:\\Program Files\\Quantex' : '/usr/local/bin',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable' as const,
    }
    inspectSelfSpy.mockResolvedValue(inspection)
    upgradeSelfSpy.mockResolvedValue({
      error: {
        kind: 'permission',
        message: 'Failed to replace the current Quantex binary.',
      },
      installSource: 'binary',
      success: false,
    })

    await expect(upgradeCommand()).resolves.toBe(2)

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Manual recovery:'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('download and replace the binary'))
  })

  it('shows a retry hint when another self upgrade already holds the lock', async () => {
    const inspection = {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/usr/local/bin/qtx',
      installSource: 'npm' as const,
      latestVersion: '1.1.0',
      packageRoot: '/usr/local/lib/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable' as const,
    }
    inspectSelfSpy.mockResolvedValue(inspection)
    upgradeSelfSpy.mockResolvedValue({
      error: {
        kind: 'locked',
        message: 'Another qtx upgrade is already running.',
      },
      installSource: 'npm',
      success: false,
    })

    await expect(upgradeCommand()).resolves.toBe(2)

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Another qtx upgrade is already running.'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already running; wait for it to finish and retry'))
  })

  it('runs self upgrade when a managed source is detected', async () => {
    const inspection = {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm' as const,
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable' as const,
    }
    inspectSelfSpy.mockResolvedValue(inspection)
    upgradeSelfSpy.mockResolvedValue({
      installSource: 'npm',
      success: true,
    })

    await expect(upgradeCommand()).resolves.toBe(0)

    expect(upgradeSelfSpy).toHaveBeenCalledWith(inspection)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Upgrading Quantex CLI'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('upgraded successfully'))
  })

  it('supports --check mode when an update is available', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'beta',
    })

    await expect(upgradeCommand({ check: true, channel: 'beta' })).resolves.toBe(1)

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Update available'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('(beta)'))
  })
})
