import type { ProcessPort, ProcessRequest, ProcessResult, RuntimeOutcome } from './ports'
import {
  readProcessOutput,
  spawnCommand,
  type SpawnedProcessHandle,
  terminateProcessTree,
} from '../utils/child-process'

interface AgentProcessSpawnOptions {
  readonly cwd?: string
  readonly detached: boolean
  readonly env?: NodeJS.ProcessEnv
  readonly stdio?: ProcessRequest['stdio']
}

export interface AgentProcessPortDependencies {
  readonly platform: NodeJS.Platform
  readonly spawn: (argv: readonly string[], options: AgentProcessSpawnOptions) => SpawnedProcessHandle
  readonly terminate: (handle: SpawnedProcessHandle) => Promise<void>
  readonly writeStderr: (value: string) => void
}

const defaultDependencies: AgentProcessPortDependencies = {
  platform: process.platform,
  spawn: (argv, options) =>
    spawnCommand(argv, {
      ...options,
      stdio: options.stdio ? [...options.stdio] : undefined,
    }),
  terminate: terminateProcessTree,
  writeStderr: value => {
    process.stderr.write(value)
  },
}

type ProcessRaceResult =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'completed'; readonly result: Awaited<ReturnType<typeof readProcessOutput>> }
  | { readonly kind: 'timed-out' }

export function createAgentProcessPort(dependencies: AgentProcessPortDependencies = defaultDependencies): ProcessPort {
  return {
    async run(request): Promise<RuntimeOutcome<ProcessResult>> {
      if (request.signal.aborted) return cancelled(request.signal)

      let handle: SpawnedProcessHandle
      try {
        handle = dependencies.spawn(request.argv, {
          ...(request.cwd ? { cwd: request.cwd } : {}),
          detached: dependencies.platform !== 'win32',
          ...(request.env ? { env: { ...process.env, ...request.env } } : {}),
          stdio: request.stdio,
        })
      } catch (error) {
        return failure('failed', errorReason(error, 'Failed to launch agent process.'))
      }

      const completed = readProcessOutput(handle)
      let timeout: ReturnType<typeof setTimeout> | undefined
      let resolveCancelled!: () => void
      const cancellation = new Promise<ProcessRaceResult>(resolve => {
        resolveCancelled = () => resolve({ kind: 'cancelled' })
        request.signal.addEventListener('abort', resolveCancelled, { once: true })
        if (request.signal.aborted) resolveCancelled()
      })
      const completion = completed.then(result => ({ kind: 'completed' as const, result }))
      const timeoutResult =
        request.timeoutMs === undefined
          ? undefined
          : new Promise<ProcessRaceResult>(resolve => {
              timeout = setTimeout(() => resolve({ kind: 'timed-out' }), request.timeoutMs)
            })

      try {
        const result = await Promise.race(
          timeoutResult ? [completion, cancellation, timeoutResult] : [completion, cancellation],
        )
        if (result.kind === 'completed') return complete(result.result, request, dependencies)

        if (result.kind === 'cancelled') {
          await dependencies.terminate(handle)
          await completed.catch(() => undefined)
          return cancelled(request.signal)
        }

        const lateResult = await settleWithin(completion, timeoutGraceMs(request.timeoutMs!))
        if (lateResult) return complete(lateResult.result, request, dependencies)

        await dependencies.terminate(handle)
        await completed.catch(() => undefined)
        return failure('timed-out', `Agent process timed out after ${request.timeoutMs}ms.`)
      } finally {
        if (timeout) clearTimeout(timeout)
        request.signal.removeEventListener('abort', resolveCancelled)
      }
    },
  }
}

function complete(
  result: Awaited<ReturnType<typeof readProcessOutput>>,
  request: ProcessRequest,
  dependencies: AgentProcessPortDependencies,
): RuntimeOutcome<ProcessResult> {
  if (request.stdio?.[1] === 'pipe' && result.stdout) dependencies.writeStderr(result.stdout)
  if (request.stdio?.[2] === 'pipe' && result.stderr) dependencies.writeStderr(result.stderr)
  const encoder = new TextEncoder()
  return {
    kind: 'success',
    value: {
      exitCode: result.exitCode,
      ...(result.stderr ? { stderr: encoder.encode(result.stderr) } : {}),
      ...(result.stdout ? { stdout: encoder.encode(result.stdout) } : {}),
    },
  }
}

function cancelled(signal: AbortSignal): RuntimeOutcome<never> {
  return failure('cancelled', abortReason(signal) ?? 'Agent process was cancelled.')
}

function failure(kind: 'cancelled' | 'failed' | 'timed-out', message: string): RuntimeOutcome<never> {
  return { error: { kind, message }, kind: 'failure' }
}

function abortReason(signal: AbortSignal): string | undefined {
  if (signal.reason === undefined) return undefined
  return signal.reason instanceof Error ? signal.reason.message : String(signal.reason)
}

function errorReason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function timeoutGraceMs(timeoutMs: number): number {
  return Math.max(1, Math.min(timeoutMs, 250))
}

async function settleWithin<T>(promise: Promise<T>, durationMs: number): Promise<T | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>(resolve => {
        timeout = setTimeout(() => resolve(undefined), durationMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
