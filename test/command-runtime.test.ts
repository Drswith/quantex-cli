import type { CommandResult } from '../src/output/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import { executeCommandWithRuntime } from '../src/command-runtime'
import { createSuccessResult } from '../src/output'

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
    if (originalHome === undefined)
      delete process.env.HOME
    else
      process.env.HOME = originalHome
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
      run: async () => createSuccessResult({
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
    const run = vi.fn(async () => createSuccessResult({
      action: 'install',
      data: {
        installed: true,
      },
      target: {
        kind: 'agent',
        name: 'codex',
      },
    }))

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
})
