import type { CommandResult } from '../../src/output/types'
import { describe, expect, it, vi } from 'vitest'
import { getCommandContracts } from '../../src/command-contract'
import {
  getCommandPresentationRoute,
  presentCommandEvent,
  presentCommandResult,
} from '../../src/command-contract/presentation'

const result: CommandResult<{ value: number }> = {
  action: 'commands',
  data: { value: 1 },
  error: null,
  meta: {
    mode: 'human',
    runId: 'presentation-test',
    schemaVersion: '1',
    timestamp: '2026-07-15T00:00:00.000Z',
    version: '0.29.0',
  },
  ok: true,
  target: { kind: 'system', name: 'commands' },
  warnings: [],
}

describe('command presentation registry', () => {
  it('resolves one explicit presenter route for every stable command', () => {
    for (const contract of getCommandContracts()) {
      expect(getCommandPresentationRoute(contract.name)?.presenterId).toBe(contract.presenterId)
    }
    expect(getCommandPresentationRoute('internal-action')).toBeUndefined()
  })

  it('routes the canonical result through the selected human renderer', () => {
    const renderer = vi.fn()
    const emitEvent = vi.fn()

    presentCommandResult(getCommandPresentationRoute(result.action), 'human', result, renderer, vi.fn(), emitEvent)

    expect(renderer).toHaveBeenCalledWith(result)
    expect(emitEvent).not.toHaveBeenCalled()
  })

  it('preserves the JSON v1 result projection', () => {
    const emitJson = vi.fn()

    presentCommandResult(getCommandPresentationRoute(result.action), 'json', result, vi.fn(), emitJson, vi.fn())

    expect(emitJson).toHaveBeenCalledWith(JSON.stringify(result, null, 2))
  })

  it('preserves the NDJSON v1 result event projection', () => {
    const emitEvent = vi.fn()

    presentCommandResult(getCommandPresentationRoute(result.action), 'ndjson', result, vi.fn(), vi.fn(), emitEvent)

    expect(emitEvent).toHaveBeenCalledWith({
      action: 'commands',
      data: result,
      target: result.target,
      type: 'result',
    })
  })

  it.each(['started', 'progress', 'cancelled'] as const)(
    'routes %s events through the registered presenter without changing the v1 shape',
    type => {
      const event = { action: 'commands', data: { step: 1 }, type }
      const emitEvent = vi.fn(input => input)

      expect(presentCommandEvent(getCommandPresentationRoute(event.action), 'ndjson', event, emitEvent)).toEqual(event)
      expect(emitEvent).toHaveBeenCalledWith(event)
    },
  )
})
