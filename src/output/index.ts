import type { CommandError, CommandEvent, CommandResult, CommandTarget, CommandWarning, HumanRenderer } from './types'
import { getCliContext } from '../cli-context'
import {
  getCommandPresentationRoute,
  presentCommandEvent,
  presentCommandResult,
} from '../command-contract/presentation'
import { getSelfVersion } from '../self'

const SCHEMA_VERSION = '1'

interface CreateResultOptions<T> {
  action: string
  data?: T
  error?: CommandError | null
  exitCode?: number
  ok: boolean
  target?: CommandTarget
  warnings?: CommandWarning[]
}

export function createSuccessResult<T>(options: Omit<CreateResultOptions<T>, 'error' | 'ok'>): CommandResult<T> {
  return createCommandResult({
    ...options,
    error: null,
    ok: true,
  })
}

export function createErrorResult<T>(
  options: Omit<CreateResultOptions<T>, 'ok'> & { error: CommandError },
): CommandResult<T> {
  return createCommandResult({
    ...options,
    ok: false,
  })
}

interface EmitBehaviorOptions {
  force?: boolean
}

export function emitCommandResult<T>(
  result: CommandResult<T>,
  renderHuman: HumanRenderer<T>,
  behavior: EmitBehaviorOptions = {},
): CommandResult<T> {
  const context = getCliContext()
  if (context.cancelled && !behavior.force) return result

  presentCommandResult(
    getCommandPresentationRoute(result.action),
    context.outputMode,
    result,
    renderHuman,
    serialized => console.log(serialized),
    event => emitNdjsonEvent(event),
  )

  return result
}

interface EmitCommandEventOptions<T> {
  action: string
  data?: T
  target?: CommandTarget
  type: CommandEvent['type']
}

export function emitCommandEvent<T>(
  options: EmitCommandEventOptions<T>,
  behavior: EmitBehaviorOptions = {},
): CommandEvent<T> | undefined {
  const context = getCliContext()
  if (context.cancelled && !behavior.force) return undefined
  return presentCommandEvent(getCommandPresentationRoute(options.action), context.outputMode, options, event =>
    emitNdjsonEvent(event),
  )
}

function createCommandResult<T>(options: CreateResultOptions<T>): CommandResult<T> {
  const context = getCliContext()

  return {
    action: options.action,
    data: options.data,
    error: options.error ?? null,
    exitCode: options.exitCode,
    meta: {
      fetchedAt: context.freshness?.fetchedAt,
      mode: context.outputMode,
      runId: context.runId,
      schemaVersion: SCHEMA_VERSION,
      source: context.freshness?.source,
      staleAfter: context.freshness?.staleAfter,
      timestamp: new Date().toISOString(),
      version: getSelfVersion(),
    },
    ok: options.ok,
    target: options.target,
    warnings: options.warnings ?? [],
  }
}

function createCommandEvent<T>(options: EmitCommandEventOptions<T>): CommandEvent<T> {
  const context = getCliContext()

  return {
    action: options.action,
    data: options.data,
    meta: {
      fetchedAt: context.freshness?.fetchedAt,
      mode: 'ndjson',
      runId: context.runId,
      schemaVersion: SCHEMA_VERSION,
      source: context.freshness?.source,
      staleAfter: context.freshness?.staleAfter,
      timestamp: new Date().toISOString(),
      version: getSelfVersion(),
    },
    target: options.target,
    type: options.type,
  }
}

function emitNdjsonEvent<T>(options: EmitCommandEventOptions<T>): CommandEvent<T> {
  const event = createCommandEvent(options)
  emitSerializedNdjsonEvent(event)
  return event
}

function emitSerializedNdjsonEvent(event: CommandEvent): void {
  console.log(JSON.stringify(event))
}
