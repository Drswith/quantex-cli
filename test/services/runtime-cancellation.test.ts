import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  executeWithRuntimeCancellation,
  type RuntimeCancellationDependencies,
} from '../../src/services/runtime-cancellation'

function createDependencies() {
  const listeners = new Map<NodeJS.Signals, () => void>()
  const dependencies: RuntimeCancellationDependencies = {
    clearTimeout,
    offSignal: vi.fn((signal, handler) => {
      if (listeners.get(signal) === handler) listeners.delete(signal)
    }),
    onSignal: vi.fn((signal, handler) => {
      listeners.set(signal, handler)
    }),
    setTimeout,
  }

  return {
    dependencies,
    emit(signal: NodeJS.Signals): void {
      listeners.get(signal)?.()
    },
    listeners,
  }
}

describe('executeWithRuntimeCancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a completed outcome and removes signal listeners', async () => {
    const { dependencies, listeners } = createDependencies()
    const cancelOperations = vi.fn()

    const result = await executeWithRuntimeCancellation(
      {
        cancelOperations,
        isCancelled: () => false,
        run: async () => 'done',
      },
      dependencies,
    )

    expect(result).toEqual({
      kind: 'completed',
      result: 'done',
    })
    expect(cancelOperations).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })

  it('cancels operations and returns timeout after the deadline and grace period', async () => {
    const { dependencies } = createDependencies()
    const cancelOperations = vi.fn()
    const execution = executeWithRuntimeCancellation(
      {
        cancelOperations,
        isCancelled: () => false,
        run: () => new Promise<string>(() => {}),
        timeoutMs: 100,
      },
      dependencies,
    )

    await vi.advanceTimersByTimeAsync(200)

    await expect(execution).resolves.toEqual({
      kind: 'timed-out',
      timeoutMs: 100,
    })
    expect(cancelOperations).toHaveBeenCalledTimes(1)
  })

  it('preserves a terminal result that arrives within the timeout grace period', async () => {
    const { dependencies } = createDependencies()
    const cancelOperations = vi.fn()
    const execution = executeWithRuntimeCancellation(
      {
        cancelOperations,
        isCancelled: () => false,
        run: () =>
          new Promise<string>(resolve => {
            setTimeout(() => resolve('late-result'), 150)
          }),
        timeoutMs: 100,
      },
      dependencies,
    )

    await vi.advanceTimersByTimeAsync(150)

    await expect(execution).resolves.toEqual({
      kind: 'completed',
      result: 'late-result',
    })
    expect(cancelOperations).not.toHaveBeenCalled()
  })

  it.each(['SIGINT', 'SIGTERM'] as const)('cancels operations for %s and removes listeners', async signal => {
    const { dependencies, emit, listeners } = createDependencies()
    const cancelOperations = vi.fn()
    const execution = executeWithRuntimeCancellation(
      {
        cancelOperations,
        isCancelled: () => true,
        run: () => new Promise<string>(() => {}),
      },
      dependencies,
    )

    emit(signal)

    await expect(execution).resolves.toEqual({
      kind: 'signal-cancelled',
      signal,
    })
    expect(cancelOperations).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
  })

  it('propagates command errors and removes signal listeners', async () => {
    const { dependencies, listeners } = createDependencies()
    const error = new Error('failed')

    await expect(
      executeWithRuntimeCancellation(
        {
          cancelOperations: vi.fn(),
          isCancelled: () => false,
          run: async () => {
            throw error
          },
        },
        dependencies,
      ),
    ).rejects.toBe(error)
    expect(listeners.size).toBe(0)
  })
})
