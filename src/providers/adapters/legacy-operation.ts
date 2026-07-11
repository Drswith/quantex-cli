import type { ProviderOperationContext, ProviderOutcome } from '../types'

export type PendingOperation<T> =
  | { readonly kind: 'cancelled'; readonly reason?: string }
  | { readonly kind: 'rejected'; readonly reason: string }
  | { readonly kind: 'resolved'; readonly value: T }
  | { readonly kind: 'timed-out'; readonly timeoutMs: number }

type InterruptedOperation<T> = Extract<PendingOperation<T>, { readonly kind: 'cancelled' | 'timed-out' }>

export function isInterruptedOperation<T>(operation: PendingOperation<T>): operation is InterruptedOperation<T> {
  return operation.kind === 'cancelled' || operation.kind === 'timed-out'
}

export function interruptedOutcome<T>(operation: InterruptedOperation<T>): ProviderOutcome<never> {
  if (operation.kind === 'cancelled') {
    return { kind: 'cancelled', ...(operation.reason ? { reason: operation.reason } : {}) }
  }
  return operation
}

export async function runPendingOperation<T>(
  context: ProviderOperationContext,
  invoke: () => Promise<T>,
): Promise<PendingOperation<T>> {
  if (context.signal.aborted) {
    return { kind: 'cancelled', reason: abortReason(context.signal) }
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  let cancel!: () => void
  const cancellation = new Promise<PendingOperation<T>>(resolve => {
    cancel = () => resolve({ kind: 'cancelled', reason: abortReason(context.signal) })
    context.signal.addEventListener('abort', cancel, { once: true })
  })
  const operation: Promise<PendingOperation<T>> = Promise.resolve()
    .then(invoke)
    .then(value => ({ kind: 'resolved' as const, value }))
    .catch(error => ({ kind: 'rejected' as const, reason: safeErrorReason(error) }))
  const pending: Promise<PendingOperation<T>>[] = [operation, cancellation]

  if (context.timeoutMs !== undefined) {
    pending.push(
      new Promise(resolve => {
        timeout = setTimeout(() => resolve({ kind: 'timed-out', timeoutMs: context.timeoutMs! }), context.timeoutMs)
      }),
    )
  }

  const outcome = await Promise.race(pending)
  if (timeout) clearTimeout(timeout)
  context.signal.removeEventListener('abort', cancel)
  return outcome
}

function abortReason(signal: AbortSignal): string | undefined {
  if (typeof signal.reason === 'string') return signal.reason
  if (signal.reason instanceof Error) return signal.reason.message
  return signal.reason === undefined ? undefined : String(signal.reason)
}

function safeErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
