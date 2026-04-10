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
      installSource: 'npm',
      latestVersion: '1.0.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
    })

    await upgradeCommand()

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already up to date'))
  })

  it('refuses to auto-update from unsupported install sources', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: false,
      currentVersion: '1.0.0',
      installSource: 'source',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
    })

    await upgradeCommand()

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cannot auto-update'))
  })

  it('runs self upgrade when a managed source is detected', async () => {
    const inspection = {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      installSource: 'npm' as const,
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
    }
    inspectSelfSpy.mockResolvedValue(inspection)
    upgradeSelfSpy.mockResolvedValue({
      installSource: 'npm',
      success: true,
    })

    await upgradeCommand()

    expect(upgradeSelfSpy).toHaveBeenCalledWith(inspection)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Upgrading Quantex CLI'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('upgraded successfully'))
  })
})
