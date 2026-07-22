import type { OutputMode } from '../cli-context'
import type { ProviderOperationContext, ProviderOutputPolicy, ProviderResourceCleanup } from '../providers'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'
import { ProcessInterruptionError } from '../utils/child-process'

const CLEANUP_GRACE_MS = 500
const FORCE_GRACE_MS = 250

export interface CliOperationContext {
  readonly context: ProviderOperationContext
  dispose(): void
  run<T>(invoke: () => Promise<T>): Promise<T>
}

export function createCliOperationContext(): CliOperationContext {
  const cliContext = getCliContext()
  const controller = new AbortController()
  const cleanups = new Set<ProviderResourceCleanup>()
  if (cliContext.cancelled) controller.abort('cancelled')
  const unregister = registerCliCancellationHandler(async () => {
    controller.abort('cancelled')
    const resources = [...cleanups]
    const graceful = Promise.allSettled(resources.map(resource => Promise.resolve().then(() => resource.cleanup())))
    if (await settlesWithin(graceful, CLEANUP_GRACE_MS)) return
    const forced = Promise.allSettled(resources.map(resource => Promise.resolve().then(() => resource.force?.())))
    await settlesWithin(forced, FORCE_GRACE_MS)
  })

  return {
    context: {
      outputPolicy: resolveCliProviderOutputPolicy(cliContext.outputMode),
      registerCleanup(cleanup): () => void {
        cleanups.add(cleanup)
        return () => cleanups.delete(cleanup)
      },
      signal: controller.signal,
      timeoutMs: cliContext.timeoutMs,
    },
    dispose(): void {
      unregister()
      cleanups.clear()
    },
    async run<T>(invoke: () => Promise<T>): Promise<T> {
      if (controller.signal.aborted) throw cancelledError(controller.signal)
      let cancel!: () => void
      const cancellation = new Promise<never>((_resolve, reject) => {
        cancel = () => reject(cancelledError(controller.signal))
        controller.signal.addEventListener('abort', cancel, { once: true })
      })
      try {
        return await Promise.race([Promise.resolve().then(invoke), cancellation])
      } finally {
        controller.signal.removeEventListener('abort', cancel)
      }
    },
  }
}

export function resolveCliProviderOutputPolicy(outputMode: OutputMode): ProviderOutputPolicy {
  return outputMode === 'human' ? 'inherit' : 'stderr'
}

function cancelledError(signal: AbortSignal): ProcessInterruptionError {
  const reason =
    typeof signal.reason === 'string'
      ? signal.reason
      : signal.reason instanceof Error
        ? signal.reason.message
        : signal.reason === undefined
          ? undefined
          : String(signal.reason)
  return new ProcessInterruptionError({ kind: 'cancelled', reason })
}

async function settlesWithin(work: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work.then(() => true),
      new Promise<false>(resolve => {
        timeout = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
