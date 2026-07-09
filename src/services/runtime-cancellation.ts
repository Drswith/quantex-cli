import process from 'node:process'

type SupportedSignal = 'SIGINT' | 'SIGTERM'
type SignalHandler = () => void

export type RuntimeDeadlineOutcome<T> =
  | {
      kind: 'completed'
      result: T
    }
  | {
      kind: 'timed-out'
      timeoutMs: number
    }

export type RuntimeSignalOutcome<T> =
  | {
      kind: 'completed'
      result: T
    }
  | {
      kind: 'signal-cancelled'
      signal: SupportedSignal
    }

export type RuntimeCancellationOutcome<T> =
  | RuntimeDeadlineOutcome<T>
  | Extract<RuntimeSignalOutcome<T>, { kind: 'signal-cancelled' }>

export interface RuntimeCancellationOptions<T> {
  cancelOperations: () => Promise<void> | void
  isCancelled: () => boolean
  run: () => Promise<T>
  timeoutMs?: number
}

export interface RuntimeCancellationDependencies {
  clearTimeout: typeof clearTimeout
  offSignal: (signal: SupportedSignal, handler: SignalHandler) => void
  onSignal: (signal: SupportedSignal, handler: SignalHandler) => void
  setTimeout: typeof setTimeout
}

function createDefaultDependencies(): RuntimeCancellationDependencies {
  return {
    clearTimeout,
    offSignal: (signal, handler) => process.off(signal, handler),
    onSignal: (signal, handler) => process.once(signal, handler),
    setTimeout,
  }
}

export async function executeWithRuntimeCancellation<T>(
  options: RuntimeCancellationOptions<T>,
  dependencies: RuntimeCancellationDependencies = createDefaultDependencies(),
): Promise<RuntimeCancellationOutcome<T>> {
  const signalOutcome = await executeWithSignalCancellation(
    {
      ...options,
      run: () => executeWithRuntimeDeadline(options, dependencies),
    },
    dependencies,
  )

  return signalOutcome.kind === 'completed' ? signalOutcome.result : signalOutcome
}

export async function executeWithRuntimeDeadline<T>(
  options: RuntimeCancellationOptions<T>,
  dependencies: RuntimeCancellationDependencies = createDefaultDependencies(),
): Promise<RuntimeDeadlineOutcome<T>> {
  if (options.timeoutMs === undefined) {
    return {
      kind: 'completed',
      result: await options.run(),
    }
  }

  const timeoutMs = options.timeoutMs
  const timeoutMarker = { kind: 'timeout-marker' } as const
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timeoutPromise = new Promise<typeof timeoutMarker>(resolve => {
      timeoutId = dependencies.setTimeout(() => resolve(timeoutMarker), timeoutMs)
    })
    const runPromise = runUntilTimeoutCancellation(options, timeoutPromise, timeoutMarker)
    const firstResult = await Promise.race([runPromise, timeoutPromise])

    if (firstResult.kind === 'run-result') {
      return {
        kind: 'completed',
        result: firstResult.result,
      }
    }

    const lateResult = await waitForLateTerminalCompletion(runPromise, timeoutMs, dependencies)
    if (lateResult?.kind === 'run-result') {
      return {
        kind: 'completed',
        result: lateResult.result,
      }
    }

    await options.cancelOperations()
    return {
      kind: 'timed-out',
      timeoutMs,
    }
  } finally {
    if (timeoutId !== undefined) dependencies.clearTimeout(timeoutId)
  }
}

async function runUntilTimeoutCancellation<T>(
  options: RuntimeCancellationOptions<T>,
  timeoutPromise: Promise<{ kind: 'timeout-marker' }>,
  timeoutMarker: { kind: 'timeout-marker' },
): Promise<{ kind: 'run-result'; result: T } | { kind: 'timeout-marker' }> {
  try {
    return {
      kind: 'run-result',
      result: await options.run(),
    }
  } catch (error) {
    if (options.isCancelled()) return timeoutPromise.then(() => timeoutMarker)
    throw error
  }
}

async function waitForLateTerminalCompletion<T>(
  runPromise: Promise<{ kind: 'run-result'; result: T } | { kind: 'timeout-marker' }>,
  timeoutMs: number,
  dependencies: RuntimeCancellationDependencies,
): Promise<{ kind: 'run-result'; result: T } | { kind: 'timeout-marker' } | undefined> {
  const graceMs = Math.min(timeoutMs, 250)
  return Promise.race([
    runPromise,
    new Promise<undefined>(resolve => {
      dependencies.setTimeout(() => resolve(undefined), graceMs)
    }),
  ])
}

export async function executeWithSignalCancellation<T>(
  options: RuntimeCancellationOptions<T>,
  dependencies: RuntimeCancellationDependencies = createDefaultDependencies(),
): Promise<RuntimeSignalOutcome<T>> {
  let signalOutcomePromise: Promise<RuntimeSignalOutcome<T>> | undefined
  let cleanup: (() => void) | undefined

  const signalPromise = new Promise<RuntimeSignalOutcome<T>>(resolve => {
    const handleSignal = (signal: SupportedSignal): void => {
      signalOutcomePromise ??= Promise.resolve()
        .then(options.cancelOperations)
        .then(() => ({
          kind: 'signal-cancelled' as const,
          signal,
        }))
      void signalOutcomePromise.then(resolve)
    }

    const sigintHandler = (): void => handleSignal('SIGINT')
    const sigtermHandler = (): void => handleSignal('SIGTERM')
    dependencies.onSignal('SIGINT', sigintHandler)
    dependencies.onSignal('SIGTERM', sigtermHandler)
    cleanup = () => {
      dependencies.offSignal('SIGINT', sigintHandler)
      dependencies.offSignal('SIGTERM', sigtermHandler)
    }
  })

  try {
    return await Promise.race([
      runUntilSignalCancellation(
        options,
        () => options.run(),
        () => signalOutcomePromise,
      ),
      signalPromise,
    ])
  } finally {
    cleanup?.()
  }
}

async function runUntilSignalCancellation<T>(
  options: RuntimeCancellationOptions<T>,
  run: () => Promise<T>,
  getSignalOutcome: () => Promise<RuntimeSignalOutcome<T>> | undefined,
): Promise<RuntimeSignalOutcome<T>> {
  try {
    const result: RuntimeSignalOutcome<T> = {
      kind: 'completed',
      result: await run(),
    }
    const signalOutcome = getSignalOutcome()
    if (options.isCancelled() && signalOutcome) return signalOutcome
    return result
  } catch (error) {
    const signalOutcome = getSignalOutcome()
    if (options.isCancelled() && signalOutcome) return signalOutcome
    throw error
  }
}
