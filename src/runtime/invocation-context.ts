import type { RuntimePorts } from './ports'

export type CacheMode = 'default' | 'no-cache' | 'refresh'
export type OutputMode = 'human' | 'json' | 'ndjson'

export interface InvocationOptions {
  readonly cacheMode: CacheMode
  readonly dryRun: boolean
  readonly outputMode: OutputMode
  readonly quiet: boolean
  readonly timeoutMs?: number
}

export interface CreateInvocationContextOptions {
  readonly cacheMode?: CacheMode
  readonly dryRun?: boolean
  readonly outputMode?: OutputMode
  readonly ports: RuntimePorts
  readonly quiet?: boolean
  readonly timeoutMs?: number
}

export type CancellationHandler = (reason?: unknown) => Promise<void> | void

export interface InvocationContext {
  readonly options: Readonly<InvocationOptions>
  readonly ports: Readonly<RuntimePorts>
  readonly signal: AbortSignal
  cancel(reason?: unknown): Promise<void>
  onCancel(handler: CancellationHandler): () => void
}

export function createInvocationContext(input: CreateInvocationContextOptions): InvocationContext {
  const controller = new AbortController()
  const handlers = new Set<CancellationHandler>()
  const options: Readonly<InvocationOptions> = Object.freeze({
    cacheMode: input.cacheMode ?? 'default',
    dryRun: input.dryRun ?? false,
    outputMode: input.outputMode ?? 'human',
    quiet: input.quiet ?? false,
    timeoutMs: input.timeoutMs,
  })
  const ports: Readonly<RuntimePorts> = Object.freeze({ ...input.ports })
  let cancellation: Promise<void> | undefined

  return {
    options,
    ports,
    signal: controller.signal,
    cancel(reason?: unknown): Promise<void> {
      if (cancellation) return cancellation

      let completeCancellation!: () => void
      cancellation = new Promise<void>(resolve => {
        completeCancellation = resolve
      })
      controller.abort(reason)
      const pendingHandlers = [...handlers]
      handlers.clear()
      void Promise.allSettled(pendingHandlers.map(handler => Promise.resolve().then(() => handler(reason)))).then(() =>
        completeCancellation(),
      )

      return cancellation
    },
    onCancel(handler: CancellationHandler): () => void {
      if (controller.signal.aborted) return () => undefined

      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }
}
