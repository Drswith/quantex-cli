import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { parseDurationToMs } from './utils/duration'

export type OutputMode = 'human' | 'json' | 'ndjson'
export type CacheMode = 'default' | 'no-cache' | 'refresh'
export type FreshnessSource = 'cache' | 'network'

export interface CliFreshness {
  fetchedAt: string
  source: FreshnessSource
  staleAfter: string
}

export interface CliContext {
  cacheMode?: CacheMode
  cancelled?: boolean
  freshness?: CliFreshness
  idempotencyKey?: string
  interactive: boolean
  outputMode: OutputMode
  runId: string
  timeoutMs?: number
}

export interface CliContextOptions {
  idempotencyKey?: string
  json?: boolean
  noCache?: boolean
  nonInteractive?: boolean
  output?: string
  refresh?: boolean
  runId?: string
  timeout?: string
}

let currentContext: CliContext | undefined
let cancellationHandlers = new Set<() => void>()

export function getCliContext(): CliContext {
  currentContext ??= createDefaultCliContext()
  return currentContext
}

export function setCliContext(context: CliContext): void {
  cancellationHandlers = new Set()
  currentContext = {
    ...context,
    cacheMode: context.cacheMode ?? 'default',
    cancelled: context.cancelled ?? false,
  }
}

export function resetCliContext(): void {
  currentContext = undefined
  cancellationHandlers = new Set()
}

export function resolveCliContext(options: CliContextOptions = {}): CliContext {
  const stdinInteractive = process.stdin.isTTY !== false
  const stdoutInteractive = process.stdout.isTTY !== false
  const outputMode = options.json || options.output === 'json'
    ? 'json'
    : options.output === 'ndjson'
      ? 'ndjson'
      : 'human'
  const timeoutMs = options.timeout === undefined ? undefined : parseDurationToMs(options.timeout)

  if (options.timeout !== undefined && timeoutMs === undefined)
    throw new Error(`Invalid timeout value: ${options.timeout}`)
  if (options.refresh && options.noCache)
    throw new Error('Cannot combine --refresh with --no-cache.')

  return {
    cacheMode: options.noCache ? 'no-cache' : options.refresh ? 'refresh' : 'default',
    cancelled: false,
    idempotencyKey: options.idempotencyKey,
    interactive: !options.nonInteractive && stdinInteractive && stdoutInteractive,
    outputMode,
    runId: options.runId ?? process.env.QUANTEX_RUN_ID ?? randomUUID(),
    timeoutMs,
  }
}

export function markCliContextCancelled(): void {
  if (currentContext)
    currentContext.cancelled = true
}

export function cancelCliContextOperations(): void {
  markCliContextCancelled()
  for (const handler of cancellationHandlers)
    handler()
  cancellationHandlers.clear()
}

export function registerCliCancellationHandler(handler: () => void): () => void {
  cancellationHandlers.add(handler)
  return () => {
    cancellationHandlers.delete(handler)
  }
}

export function recordCliFreshness(freshness: CliFreshness): void {
  const context = getCliContext()

  if (!context.freshness) {
    context.freshness = freshness
    return
  }

  context.freshness = {
    fetchedAt: context.freshness.fetchedAt <= freshness.fetchedAt ? context.freshness.fetchedAt : freshness.fetchedAt,
    source: context.freshness.source === 'network' && freshness.source === 'network' ? 'network' : 'cache',
    staleAfter: context.freshness.staleAfter <= freshness.staleAfter ? context.freshness.staleAfter : freshness.staleAfter,
  }
}

function createDefaultCliContext(): CliContext {
  return resolveCliContext()
}
