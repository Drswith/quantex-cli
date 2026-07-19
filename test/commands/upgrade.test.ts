import type { SelfUpgradePlan } from '../../src/self'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCliContext, setCliContext } from '../../src/cli-context'
import { resolveUpgradeChannelOption, upgradeCommand } from '../../src/commands/upgrade'
import * as selfModule from '../../src/self'

const planSelfUpgradeSpy = vi.spyOn(selfModule, 'planSelfUpgrade')
const upgradeSelfSpy = vi.spyOn(selfModule, 'upgradeSelf')

afterAll(() => {
  planSelfUpgradeSpy.mockRestore()
  upgradeSelfSpy.mockRestore()
})

describe('upgradeCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCliContext()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    planSelfUpgradeSpy.mockClear()
    upgradeSelfSpy.mockClear()
  })

  afterEach(() => {
    resetCliContext()
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows up to date when latest version matches current version', async () => {
    planSelfUpgradeSpy.mockResolvedValue(createPlan({ targetVersion: '1.0.0' }, 'up-to-date'))

    await expect(upgradeCommand()).resolves.toMatchObject({ ok: true })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already up to date'))
  })

  it('reports check unavailable when latest version cannot be resolved', async () => {
    planSelfUpgradeSpy.mockResolvedValue(createPlan({}, 'check-unavailable'))

    await expect(upgradeCommand({ check: true })).resolves.toMatchObject({
      data: { status: 'check-unavailable' },
      error: { code: 'NETWORK_ERROR' },
      ok: false,
    })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to determine the latest'))
  })

  it('treats a lower latest version as stale instead of attempting a downgrade', async () => {
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          currentVersion: '0.15.0',
          targetVersion: '0.14.0',
        },
        'up-to-date',
      ),
    )

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
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          managedRegistry: 'https://registry.npmmirror.com',
          targetVersion: '1.0.0',
          upstreamLatestVersion: '1.1.0',
        },
        'up-to-date',
      ),
    )

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
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          canAutoUpdate: false,
          installSource: 'source',
          targetVersion: '1.1.0',
        },
        'manual-required',
      ),
    )

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
    const plan = createPlan(
      {
        executablePath: '/Users/test/.bun/bin/qtx',
        installSource: 'bun',
        packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
        targetVersion: '1.1.0',
      },
      'update-available',
    )
    planSelfUpgradeSpy.mockResolvedValue(plan)
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
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          executablePath: '/usr/local/bin/qtx',
          installSource: 'npm',
          packageRoot: '/usr/local/lib/node_modules/quantex-cli',
          targetVersion: '1.1.0',
        },
        'update-available',
      ),
    )
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
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          executablePath,
          installSource: 'binary',
          packageRoot: process.platform === 'win32' ? 'C:\\Program Files\\Quantex' : '/usr/local/bin',
          targetVersion: '1.1.0',
        },
        'update-available',
      ),
    )
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
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          executablePath: '/usr/local/bin/qtx',
          installSource: 'npm',
          packageRoot: '/usr/local/lib/node_modules/quantex-cli',
          targetVersion: '1.1.0',
        },
        'update-available',
      ),
    )
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
    const plan = createPlan({ targetVersion: '1.1.0' }, 'update-available')
    planSelfUpgradeSpy.mockResolvedValue(plan)
    upgradeSelfSpy.mockResolvedValue({
      installSource: 'npm',
      success: true,
    })

    await expect(upgradeCommand()).resolves.toMatchObject({ ok: true })

    expect(upgradeSelfSpy).toHaveBeenCalledWith(
      plan,
      expect.objectContaining({
        lockPort: expect.objectContaining({ acquire: expect.any(Function) }),
        signal: expect.any(AbortSignal),
      }),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Upgrading Quantex CLI'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('upgraded successfully'))
  })

  it('supports --check mode when an update is available', async () => {
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan({ targetVersion: '1.1.0', updateChannel: 'beta' }, 'update-available'),
    )

    await expect(upgradeCommand({ check: true, channel: 'beta' })).resolves.toMatchObject({
      exitCode: 1,
      ok: true,
    })

    expect(upgradeSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Update available'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('(beta)'))
  })

  it('forwards explicit --channel stable into self-upgrade planning', async () => {
    planSelfUpgradeSpy.mockResolvedValue(createPlan({ updateChannel: 'stable' }, 'up-to-date'))

    await expect(upgradeCommand({ channel: 'stable' })).resolves.toMatchObject({ ok: true })

    expect(planSelfUpgradeSpy).toHaveBeenCalledWith(expect.objectContaining({ updateChannel: 'stable' }))
    expect(upgradeSelfSpy).not.toHaveBeenCalled()
  })

  it('resolves only valid upgrade channel option values', () => {
    expect(resolveUpgradeChannelOption('stable')).toBe('stable')
    expect(resolveUpgradeChannelOption('beta')).toBe('beta')
    expect(resolveUpgradeChannelOption(undefined)).toBeUndefined()
    expect(resolveUpgradeChannelOption('nightly')).toBeUndefined()
  })

  it('treats a lower latest version as up to date in --check mode', async () => {
    planSelfUpgradeSpy.mockResolvedValue(
      createPlan(
        {
          currentVersion: '0.15.0',
          targetVersion: '0.14.0',
        },
        'up-to-date',
      ),
    )

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
    planSelfUpgradeSpy.mockResolvedValue(createPlan({ targetVersion: '1.1.0' }, 'update-available'))

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
    planSelfUpgradeSpy.mockResolvedValue(createPlan({ targetVersion: '1.1.0' }, 'update-available'))

    const result = await upgradeCommand()

    expect(result.ok).toBe(true)
    expect(result.data?.status).toBe('update-available')
    expect(result.warnings[0]?.code).toBe('DRY_RUN')
    expect(upgradeSelfSpy).not.toHaveBeenCalled()
  })
})

function createPlan(
  overrides: {
    canAutoUpdate?: boolean
    currentVersion?: string
    executablePath?: string
    installSource?: 'binary' | 'bun' | 'npm' | 'source' | 'unknown'
    managedRegistry?: string
    packageRoot?: string
    targetVersion?: string
    updateChannel?: 'beta' | 'stable'
    upstreamLatestVersion?: string
  } = {},
  status: 'check-unavailable' | 'manual-required' | 'up-to-date' | 'update-available' = 'update-available',
): SelfUpgradePlan {
  const facts = {
    canAutoUpdate: overrides.canAutoUpdate ?? true,
    currentVersion: overrides.currentVersion ?? '1.0.0',
    executablePath: overrides.executablePath ?? '/tmp/quantex',
    installSource: overrides.installSource ?? 'npm',
    packageRoot: overrides.packageRoot ?? '/tmp/quantex',
    updateChannel: overrides.updateChannel ?? 'stable',
  } as const

  return {
    facts,
    status,
    target: {
      managedRegistry: overrides.managedRegistry,
      packageTag: facts.updateChannel === 'beta' ? ('beta' as const) : ('latest' as const),
      targetVersion: overrides.targetVersion,
      upstreamLatestVersion: overrides.upstreamLatestVersion,
      verificationCommand: [process.execPath, `${facts.packageRoot}/dist/cli.mjs`, '--version'],
    },
    updateAvailable: status === 'update-available',
  }
}
