import type { CommandResult } from '../src/output/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import { executeCommandWithRuntime } from '../src/command-runtime'
import { createSuccessResult } from '../src/output'
import * as selfModule from '../src/self'
import { saveState } from '../src/state'

const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelf')

describe('executeCommandWithRuntime', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let tempHome: string
  const originalHome = process.env.HOME

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    tempHome = mkdtempSync(join(tmpdir(), 'quantex-runtime-'))
    process.env.HOME = tempHome
  })

  afterEach(() => {
    logSpy.mockRestore()
    inspectSelfSpy.mockReset()
    vi.useRealTimers()
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    rmSync(tempHome, { force: true, recursive: true })
  })

  it('returns a timeout error when execution exceeds the configured deadline', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'timeout-run-id',
      timeoutMs: 1,
    })

    const result = await executeCommandWithRuntime({
      action: 'install',
      run: () => new Promise<CommandResult<unknown>>(() => {}),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    const cancelledEvent = JSON.parse(logSpy.mock.calls[0][0])
    const resultEvent = JSON.parse(logSpy.mock.calls[1][0])
    expect(cancelledEvent.type).toBe('cancelled')
    expect(cancelledEvent.data.reason).toBe('timeout')
    expect(resultEvent.type).toBe('result')
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('TIMEOUT')
  })

  it('passes through successful results before the timeout fires', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'timeout-run-id',
      timeoutMs: 1000,
    })

    const result = await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: {
            agents: [],
          },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(result.ok).toBe(true)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('replays the stored result for a repeated idempotency key', async () => {
    const run = vi.fn(async () =>
      createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
      }),
    )

    setCliContext({
      idempotencyKey: 'install-codex',
      interactive: false,
      outputMode: 'json',
      runId: 'first-run-id',
    })

    await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    setCliContext({
      idempotencyKey: 'install-codex',
      interactive: false,
      outputMode: 'json',
      runId: 'second-run-id',
    })

    const replayed = await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(run).toHaveBeenCalledTimes(1)
    expect(replayed.ok).toBe(true)
    expect(replayed.meta.runId).toBe('second-run-id')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"runId": "second-run-id"'))
  })

  it('returns a cancelled error when the process receives a termination signal', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'signal-run-id',
    })

    const execution = executeCommandWithRuntime({
      action: 'update',
      run: () => new Promise<CommandResult<unknown>>(() => {}),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    process.emit('SIGTERM')

    const result = await execution
    const cancelledEvent = JSON.parse(logSpy.mock.calls[0][0])
    expect(cancelledEvent.type).toBe('cancelled')
    expect(cancelledEvent.data.signal).toBe('SIGTERM')
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CANCELLED')
  })

  it('shows a passive self-update notice after a successful human-mode command', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T08:00:00.000Z'))
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

    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'human-run-id',
    })

    const result = await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: { agents: [] },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(result.ok).toBe(true)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Quantex CLI 1.1.0 is available'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Run `quantex upgrade`.'))
    stdoutWriteSpy.mockRestore()
  })

  it('suppresses the passive notice in structured output modes', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
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

    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'json-run-id',
    })

    await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: { agents: [] },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).not.toHaveBeenCalledWith(expect.stringContaining('Quantex CLI 1.1.0 is available'))
    stdoutWriteSpy.mockRestore()
  })

  it('suppresses repeated reminders for the same target version inside the throttle window', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T08:00:00.000Z'))
    await saveState({
      installedAgents: {},
      self: {
        updateNoticeAt: '2026-05-01T00:00:00.000Z',
        updateNoticeVersion: '1.1.0',
      },
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

    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'human-run-id',
    })

    await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: { agents: [] },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(stdoutWriteSpy).not.toHaveBeenCalledWith(expect.stringContaining('Quantex CLI 1.1.0 is available'))
    stdoutWriteSpy.mockRestore()
  })

  it('skips passive reminders for doctor because that command owns self-upgrade messaging', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
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

    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'doctor-run-id',
    })

    await executeCommandWithRuntime({
      action: 'doctor',
      run: async () =>
        createSuccessResult({
          action: 'doctor',
          data: { issues: [] },
          target: {
            kind: 'system',
            name: 'doctor',
          },
        }),
      target: {
        kind: 'system',
        name: 'doctor',
      },
    })

    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).not.toHaveBeenCalledWith(expect.stringContaining('Quantex CLI 1.1.0 is available'))
    stdoutWriteSpy.mockRestore()
  })
})
