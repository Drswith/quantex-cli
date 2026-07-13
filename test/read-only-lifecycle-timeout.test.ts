import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import * as smoke from '../scripts/read-only-lifecycle-smoke'

type WaitForChildExit = (
  child: EventEmitter & { kill(signal: NodeJS.Signals): boolean },
  options: { commandLabel: string; graceMs: number; timeoutMs: number },
) => Promise<number>

describe('read-only lifecycle child timeout', () => {
  it('resolves a normal child exit without sending a signal', async () => {
    const waitForChildExit = getWaitForChildExit()
    const child = new FakeChild()
    const result = waitForChildExit(child, { commandLabel: 'normal probe', graceMs: 5, timeoutMs: 50 })
    child.emit('close', 0)

    await expect(result).resolves.toBe(0)
    expect(child.signals).toEqual([])
  })

  it('escalates from SIGTERM to SIGKILL and rejects a hung child', async () => {
    const waitForChildExit = getWaitForChildExit()
    const child = new FakeChild()

    await expect(waitForChildExit(child, { commandLabel: 'hung probe', graceMs: 5, timeoutMs: 5 })).rejects.toThrow(
      /hung probe.*timed out/i,
    )
    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL'])
  })
})

class FakeChild extends EventEmitter {
  readonly signals: NodeJS.Signals[] = []

  kill(signal: NodeJS.Signals): boolean {
    this.signals.push(signal)
    return true
  }
}

function getWaitForChildExit(): WaitForChildExit {
  const candidate = (smoke as typeof smoke & { waitForChildExit?: unknown }).waitForChildExit
  expect(candidate).toBeTypeOf('function')
  return candidate as WaitForChildExit
}
