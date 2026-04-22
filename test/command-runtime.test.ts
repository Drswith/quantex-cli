import type { CommandResult } from '../src/output/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import { executeCommandWithRuntime } from '../src/command-runtime'
import { createSuccessResult } from '../src/output'

describe('executeCommandWithRuntime', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
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
})
