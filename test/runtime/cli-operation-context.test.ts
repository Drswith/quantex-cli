import { describe, expect, it } from 'vitest'
import { cancelCliContextOperations, clearCliContextCancelled, setCliContext } from '../../src/cli-context'
import { createCliOperationContext } from '../../src/runtime/cli-operation-context'

describe('CLI operation context', () => {
  it.each([
    ['human', 'inherit'],
    ['json', 'stderr'],
    ['ndjson', 'stderr'],
  ] as const)('maps %s output to the explicit provider %s policy', (outputMode, outputPolicy) => {
    setCliContext({ interactive: outputMode === 'human', outputMode, runId: `${outputMode}-policy` })
    const operation = createCliOperationContext()

    expect(operation.context.outputPolicy).toBe(outputPolicy)
    operation.dispose()
  })

  it('aborts and joins live operations before cancellation completes', async () => {
    clearCliContextCancelled()
    const operation = createCliOperationContext()
    let cleanupFinished = false
    operation.context.registerCleanup?.({
      cleanup: () =>
        new Promise<void>(resolve => {
          setTimeout(() => {
            cleanupFinished = true
            resolve()
          }, 10)
        }),
    })

    await cancelCliContextOperations()

    expect(operation.context.signal.aborted).toBe(true)
    expect(cleanupFinished).toBe(true)
    operation.dispose()
  })

  it('unregisters its cancellation handler on dispose', async () => {
    clearCliContextCancelled()
    const operation = createCliOperationContext()
    operation.dispose()

    await cancelCliContextOperations()

    expect(operation.context.signal.aborted).toBe(false)
  })

  it('returns typed cancellation without joining an unresponsive application promise', async () => {
    clearCliContextCancelled()
    const operation = createCliOperationContext()
    const pending = operation.run(() => new Promise<never>(() => undefined))
    const startedAt = Date.now()

    await expect(
      Promise.race([
        cancelCliContextOperations().then(() => 'cancelled'),
        new Promise<string>(resolve => setTimeout(() => resolve('still-pending'), 100)),
      ]),
    ).resolves.toBe('cancelled')
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    expect(Date.now() - startedAt).toBeLessThan(100)
    operation.dispose()
  })

  it('bounds cleanup joins and forces resources that miss the grace period', async () => {
    clearCliContextCancelled()
    const operation = createCliOperationContext()
    let forced = false
    operation.context.registerCleanup?.({
      cleanup: () => new Promise<void>(() => undefined),
      force: () => {
        forced = true
      },
    })
    const startedAt = Date.now()

    await cancelCliContextOperations()

    expect(forced).toBe(true)
    expect(Date.now() - startedAt).toBeLessThan(1_000)
    operation.dispose()
  })
})
