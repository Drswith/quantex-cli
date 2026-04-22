import type { CommandError, CommandResult, CommandTarget, CommandWarning, HumanRenderer } from './types'
import { getCliContext } from '../cli-context'
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

export function createErrorResult<T>(options: Omit<CreateResultOptions<T>, 'ok'> & { error: CommandError }): CommandResult<T> {
  return createCommandResult({
    ...options,
    ok: false,
  })
}

export function emitCommandResult<T>(result: CommandResult<T>, renderHuman: HumanRenderer<T>): CommandResult<T> {
  const context = getCliContext()

  if (context.outputMode === 'json')
    console.log(JSON.stringify(result, null, 2))
  else
    renderHuman(result)

  return result
}

function createCommandResult<T>(options: CreateResultOptions<T>): CommandResult<T> {
  const context = getCliContext()

  return {
    action: options.action,
    data: options.data,
    error: options.error ?? null,
    exitCode: options.exitCode,
    meta: {
      mode: context.outputMode,
      runId: context.runId,
      schemaVersion: SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      version: getSelfVersion(),
    },
    ok: options.ok,
    target: options.target,
    warnings: options.warnings ?? [],
  }
}
