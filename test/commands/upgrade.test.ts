import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCliContext, setCliContext } from '../../src/cli-context'
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
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCliContext()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    inspectSelfSpy.mockClear()
    upgradeSelfSpy.mockClear()
  })

  afterEach(() => {
    resetCliContext()
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows up to date when latest version matches current version', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.0.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await expect(upgradeCommand()).resolves.toMatchObject({ ok: true })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already up to date'))
  })

  it('reports check unavailable when latest version cannot be resolved', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await expect(upgradeCommand({ check: true })).resolves.toMatchObject({
      data: { status: 'check-unavailable' },
      error: { code: 'NETWORK_ERROR' },
      ok: false,
    })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to determine the latest'))
  })

  it('treats a lower latest version as stale instead of attempting a downgrade', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '0.15.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '0.14.0',
      managedRegistry: 'https://registry.npmjs.org',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    const result = await upgradeCommand()

    expect(result.ok).toBe(true)
    expect(result.data?.status).toBe('up-to-date')
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'STALE_LATEST_VERSION',
      }),
    )
    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already up to date'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('will not downgrade'))
  })

  it('warns when upstream npm is newer than the selected registry', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.0.0',
      managedRegistry: 'https://registry.npmmirror.com',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
      upstreamLatestVersion: '1.1.0',
    })

    const result = await upgradeCommand()

    expect(result.ok).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MIRROR_LAG',
      }),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('selected registry currently installs 1.0.0'))
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

    await expect(upgradeCommand()).resolves.toMatchObject({
      error: {
        code: 'MANUAL_ACTION_REQUIRED',
      },
      ok: false,
    })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('cannot auto-update'))
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

    await expect(upgradeCommand()).resolves.toMatchObject({
      error: {
        code: 'UPGRADE_FAILED',
      },
      ok: false,
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to upgrade Quantex CLI'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Reason: Failed to update quantex-cli through Bun.'),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Next step: bun add -g quantex-cli@latest'))
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

    await expect(upgradeCommand()).resolves.toMatchObject({
      error: {
        code: 'UPGRADE_FAILED',
      },
      ok: false,
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('npm install -g quantex-cli@latest'))
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

    await expect(upgradeCommand()).resolves.toMatchObject({
      error: {
        code: 'UPGRADE_FAILED',
      },
      ok: false,
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Next step:'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('download and replace the binary'))
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

    await expect(upgradeCommand()).resolves.toMatchObject({
      error: {
        code: 'UPGRADE_FAILED',
      },
      ok: false,
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Another qtx upgrade is already running.'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('already running; wait for it to finish and retry'),
    )
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

    await expect(upgradeCommand()).resolves.toMatchObject({ ok: true })

    expect(upgradeSelfSpy).toHaveBeenCalledWith(inspection)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Upgrading Quantex CLI'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('upgraded successfully'))
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

    await expect(upgradeCommand({ check: true, channel: 'beta' })).resolves.toMatchObject({
      exitCode: 1,
      ok: true,
    })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Update available'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('(beta)'))
  })

  it('treats a lower latest version as up to date in --check mode', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '0.15.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '0.14.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    const result = await upgradeCommand({ check: true })

    expect(result.ok).toBe(true)
    expect(result.exitCode).toBeUndefined()
    expect(result.data?.status).toBe('up-to-date')
    expect(upgradeSelfSpy).not.toHaveBeenCalled()
  })

  it('emits a structured envelope in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'test-run-id',
    })
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await upgradeCommand({ check: true })

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('upgrade')
    expect(payload.exitCode).toBe(1)
    expect(payload.data.status).toBe('update-available')
    expect(payload.meta.runId).toBe('test-run-id')
  })

  it('returns a dry-run upgrade plan without invoking the upgrader', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    const result = await upgradeCommand()

    expect(result.ok).toBe(true)
    expect(result.data?.status).toBe('update-available')
    expect(result.warnings[0]?.code).toBe('DRY_RUN')
    expect(upgradeSelfSpy).not.toHaveBeenCalled()
  })
})
