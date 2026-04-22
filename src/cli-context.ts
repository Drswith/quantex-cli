import { randomUUID } from 'node:crypto'
import process from 'node:process'

export type OutputMode = 'human' | 'json' | 'ndjson'

export interface CliContext {
  interactive: boolean
  outputMode: OutputMode
  runId: string
}

export interface CliContextOptions {
  json?: boolean
  nonInteractive?: boolean
  output?: string
  runId?: string
}

let currentContext: CliContext | undefined

export function getCliContext(): CliContext {
  currentContext ??= createDefaultCliContext()
  return currentContext
}

export function setCliContext(context: CliContext): void {
  currentContext = context
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

  return {
    interactive: !options.nonInteractive && stdinInteractive && stdoutInteractive,
    outputMode,
    runId: options.runId ?? process.env.QUANTEX_RUN_ID ?? randomUUID(),
  }
}

function createDefaultCliContext(): CliContext {
  return resolveCliContext()
}
