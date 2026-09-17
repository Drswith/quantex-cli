import type { CoreError, CoreRequestOptions } from './types'

export type CoreInvocationOutcome<T> =
  | { readonly kind: 'failure'; readonly error: CoreError }
  | { readonly kind: 'success'; readonly value: T }

export interface CoreInvocationContext {
  /** Register an owned resource immediately after acquisition and before the next await. */
  registerCleanup(cleanup: CoreInvocationCleanup): () => void
  /** Attach compact domain context to a later cancellation or timeout result. */
  setInterruptionDetails(details: Readonly<Record<string, unknown>>): void
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export interface CoreInvocationCleanup {
  cleanup(): Promise<void> | void
  force?(): Promise<void> | void
}

const INTERRUPTED = Symbol('core-invocation-interrupted')
const CLEANUP_GRACE_MS = 500
const WORK_SETTLE_GRACE_MS = 50

export async function runCoreInvocation<T>(
  options: CoreRequestOptions | undefined,
  invoke: (context: CoreInvocationContext) => Promise<T>,
): Promise<CoreInvocationOutcome<T>> {
  const timeoutMs = options?.timeoutMs
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
    return {
      error: {
        code: 'invalid-request',
        message: 'timeoutMs must be a positive integer.',
        retryable: false,
      },
      kind: 'failure',
    }
  }

  const controller = new AbortController()
  const cleanups = new Set<CoreInvocationCleanup>()
  let cleanupQueue = Promise.resolve()
  const externalSignal = options?.signal
  let timedOut = false
  let interruptionDetails: Readonly<Record<string, unknown>> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  const abortFromExternal = (): void => controller.abort(externalSignal?.reason)

  if (externalSignal?.aborted) abortFromExternal()
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true })

  if (!controller.signal.aborted && timeoutMs !== undefined) {
    timeout = setTimeout(() => {
      timedOut = true
      controller.abort(`Timed out after ${timeoutMs}ms.`)
    }, timeoutMs)
  }

  if (controller.signal.aborted) {
    externalSignal?.removeEventListener('abort', abortFromExternal)
    return { error: interruptedError(controller.signal, false, timeoutMs), kind: 'failure' }
  }

  let markInterrupted!: () => void
  const queueCleanup = (resources: readonly CoreInvocationCleanup[]): Promise<void> => {
    if (resources.length === 0) return cleanupQueue
    cleanupQueue = cleanupQueue.then(() => cleanupResources(resources))
    return cleanupQueue
  }
  const drainRegisteredCleanups = (): Promise<void> => {
    const pending = [...cleanups]
    cleanups.clear()
    return queueCleanup(pending)
  }
  const interrupted = new Promise<typeof INTERRUPTED>(resolve => {
    markInterrupted = () => {
      void drainRegisteredCleanups().then(() => resolve(INTERRUPTED))
    }
    controller.signal.addEventListener('abort', markInterrupted, { once: true })
    if (controller.signal.aborted) markInterrupted()
  })
  const work = Promise.resolve().then(() =>
    invoke({
      registerCleanup(cleanup): () => void {
        if (controller.signal.aborted) {
          void queueCleanup([cleanup])
          return () => undefined
        }
        cleanups.add(cleanup)
        return () => cleanups.delete(cleanup)
      },
      setInterruptionDetails(details): void {
        interruptionDetails = { ...details }
      },
      signal: controller.signal,
      timeoutMs,
    }),
  )

  try {
    const value = await Promise.race([work, interrupted])
    if (value === INTERRUPTED || controller.signal.aborted) {
      await interrupted
      await settleWithin(work, WORK_SETTLE_GRACE_MS)
      await drainRegisteredCleanups()
      return {
        error: interruptedError(controller.signal, timedOut, timeoutMs, interruptionDetails),
        kind: 'failure',
      }
    }
    return { kind: 'success', value }
  } catch (error) {
    const kind = interruptionKind(error)
    if (controller.signal.aborted || kind) {
      if (!controller.signal.aborted) {
        timedOut ||= kind === 'timed-out'
        controller.abort(interruptionReason(error))
      }
      await interrupted
      await settleWithin(work, WORK_SETTLE_GRACE_MS)
      await drainRegisteredCleanups()
      return {
        error: interruptedError(
          controller.signal,
          timedOut || kind === 'timed-out',
          timeoutMs ?? interruptionTimeout(error),
          mergeDetails(interruptionDetails, errorDetails(error)),
        ),
        kind: 'failure',
      }
    }
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abortFromExternal)
    controller.signal.removeEventListener('abort', markInterrupted)
    cleanups.clear()
  }
}

async function cleanupResources(resources: readonly CoreInvocationCleanup[]): Promise<void> {
  const graceful = Promise.allSettled(resources.map(resource => Promise.resolve().then(() => resource.cleanup())))
  if (await settlesWithin(graceful, CLEANUP_GRACE_MS)) return
  const forced = Promise.allSettled(resources.map(resource => Promise.resolve().then(() => resource.force?.())))
  await forced
}

async function settleWithin(work: Promise<unknown>, durationMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      work.then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, durationMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function settlesWithin(work: Promise<unknown>, durationMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work.then(() => true),
      new Promise<false>(resolve => {
        timer = setTimeout(() => resolve(false), durationMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function interruptedError(
  signal: AbortSignal,
  timedOut: boolean,
  timeoutMs?: number,
  details?: Readonly<Record<string, unknown>>,
): CoreError {
  if (timedOut) {
    return {
      code: 'timed-out',
      details: mergeDetails(timeoutMs === undefined ? undefined : { timeoutMs }, details),
      message:
        timeoutMs === undefined ? 'The Core request timed out.' : `The Core request timed out after ${timeoutMs}ms.`,
      retryable: true,
    }
  }

  return {
    code: 'cancelled',
    details: mergeDetails(signal.reason === undefined ? undefined : { reason: safeReason(signal.reason) }, details),
    message: 'The Core request was cancelled.',
    retryable: false,
  }
}

function errorDetails(error: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!error || typeof error !== 'object' || !('details' in error)) return undefined
  const details = error.details
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Readonly<Record<string, unknown>>)
    : undefined
}

function mergeDetails(
  first: Readonly<Record<string, unknown>> | undefined,
  second: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!first) return second
  if (!second) return first
  return { ...first, ...second }
}

function interruptionKind(error: unknown): 'cancelled' | 'timed-out' | undefined {
  if (!error || typeof error !== 'object' || !('kind' in error)) return undefined
  const kind = error.kind
  return kind === 'cancelled' || kind === 'timed-out' ? kind : undefined
}

function interruptionTimeout(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('timeoutMs' in error)) return undefined
  return typeof error.timeoutMs === 'number' ? error.timeoutMs : undefined
}

function interruptionReason(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('reason' in error)) return error
  return error.reason
}

function safeReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  try {
    return String(reason)
  } catch {
    return 'cancelled'
  }
}
