import type { NetworkPort, RuntimeOutcome } from './ports'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface FetchNetworkPortDependencies {
  readonly fetch: FetchLike
}

const defaultDependencies: FetchNetworkPortDependencies = { fetch: globalThis.fetch.bind(globalThis) }

export function createFetchNetworkPort(dependencies: FetchNetworkPortDependencies = defaultDependencies): NetworkPort {
  return {
    async request(request) {
      if (request.signal.aborted) return cancelled(request.signal)

      const controller = new AbortController()
      let timeout: ReturnType<typeof setTimeout> | undefined
      let resolveInterruption!: (outcome: RuntimeOutcome<never>) => void
      let settled = false
      const interrupted = new Promise<RuntimeOutcome<never>>(resolve => (resolveInterruption = resolve))
      const interrupt = (outcome: RuntimeOutcome<never>): void => {
        if (settled) return
        settled = true
        controller.abort()
        resolveInterruption(outcome)
      }
      const abort = () => interrupt(cancelled(request.signal))
      request.signal.addEventListener('abort', abort, { once: true })
      if (request.signal.aborted) abort()
      if (request.timeoutMs !== undefined) {
        timeout = setTimeout(
          () => interrupt(failure('timed-out', `Network request timed out after ${request.timeoutMs}ms.`)),
          request.timeoutMs,
        )
      }

      const consumed = Promise.resolve()
        .then(
          async (): Promise<RuntimeOutcome<{ body: Uint8Array; headers: Record<string, string>; status: number }>> => {
            const response = await dependencies.fetch(request.url, {
              body: request.body as never,
              headers: request.headers,
              method: request.method,
              signal: controller.signal,
            })
            const headers: Record<string, string> = {}
            response.headers.forEach((value, key) => (headers[key.toLowerCase()] = value))
            return {
              kind: 'success',
              value: {
                body: new Uint8Array(await response.arrayBuffer()),
                headers,
                status: response.status,
              },
            }
          },
        )
        .catch(error => {
          if (request.signal.aborted) return cancelled(request.signal)
          if (controller.signal.aborted && request.timeoutMs !== undefined)
            return failure('timed-out', `Network request timed out after ${request.timeoutMs}ms.`)
          return failure('failed', error instanceof Error ? error.message : 'Network request failed.')
        })

      try {
        return await Promise.race([consumed, interrupted])
      } finally {
        settled = true
        if (timeout) clearTimeout(timeout)
        request.signal.removeEventListener('abort', abort)
      }
    },
  }
}

function cancelled(signal: AbortSignal): RuntimeOutcome<never> {
  const message =
    signal.reason instanceof Error ? signal.reason.message : String(signal.reason ?? 'Network request was cancelled.')
  return failure('cancelled', message)
}

function failure(kind: 'cancelled' | 'failed' | 'timed-out', message: string): RuntimeOutcome<never> {
  return { error: { kind, message }, kind: 'failure' }
}
