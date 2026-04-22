import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { parseDurationToMs } from './utils/duration'

export type OutputMode = 'human' | 'json' | 'ndjson'

export interface CliContext {
  cancelled?: boolean
  interactive: boolean
  outputMode: OutputMode
  runId: string
  timeoutMs?: number
}

export interface CliContextOptions {
  json?: boolean
  nonInteractive?: boolean
  output?: string
  runId?: string
  timeout?: string
}

let currentContext: CliContext | undefined

export function getCliContext(): CliContext {
  currentContext ??= createDefaultCliContext()
  return currentContext
}

export function setCliContext(context: CliContext): void {
  currentContext = {
    cancelled: false,
    ...context,
  }
}

export function resetCliContext(): void {
  currentContext = undefined
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

  return {
    cancelled: false,
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

function createDefaultCliContext(): CliContext {
  return resolveCliContext()
}
