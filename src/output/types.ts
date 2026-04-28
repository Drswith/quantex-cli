import type { FreshnessSource, OutputMode } from '../cli-context'
import type { CliErrorCode } from '../errors'

export interface CommandTarget {
  kind: 'agent' | 'config' | 'self' | 'system'
  name?: string
}

export interface CommandWarning {
  code: string
  details?: Record<string, unknown>
  message: string
}

export interface CommandError {
  code: CliErrorCode
  details?: Record<string, unknown>
  message: string
}

export interface CommandMeta {
  fetchedAt?: string
  mode: OutputMode
  runId: string
  schemaVersion: string
  source?: FreshnessSource
  staleAfter?: string
  timestamp: string
  version: string
}

export interface CommandEventMeta extends CommandMeta {
  mode: 'ndjson'
}

export interface CommandResult<T = unknown> {
  action: string
  data?: T
  error: CommandError | null
  exitCode?: number
  meta: CommandMeta
  ok: boolean
  target?: CommandTarget
  warnings: CommandWarning[]
}

export interface CommandEvent<T = unknown> {
  action: string
  data?: T
  meta: CommandEventMeta
  target?: CommandTarget
  type: 'cancelled' | 'progress' | 'result' | 'started'
}

export type HumanRenderer<T> = (result: CommandResult<T>) => void
