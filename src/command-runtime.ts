import type { CommandResult, CommandTarget } from './output/types'
import process from 'node:process'
import pc from 'picocolors'
import { cancelCliContextOperations, getCliContext } from './cli-context'
import { loadIdempotencyRecord, saveIdempotencyRecord } from './idempotency'
import { createErrorResult, emitCommandEvent, emitCommandResult } from './output'

interface ExecuteCommandOptions<T> {
  action: string
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}

export async function executeCommandWithRuntime<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  const replayedResult = await replayIdempotentResult<T>(options.action, options.target)
  if (replayedResult)
    return replayedResult

  const timeoutMs = getCliContext().timeoutMs

  if (timeoutMs === undefined)
    return withSignalCancellation(options, () => options.run().then(result => storeIdempotentResult(options.action, options.target, result)))

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timeoutPromise = new Promise<CommandResult<T>>((resolve) => {
      timeoutId = setTimeout(() => {
        cancelCliContextOperations()
        emitCommandEvent({
          action: options.action,
          data: {
            reason: 'timeout',
            timeoutMs,
          },
          target: options.target,
          type: 'cancelled',
        }, { force: true })

        resolve(emitCommandResult(createErrorResult<T>({
          action: options.action,
          error: {
            code: 'TIMEOUT',
            details: {
              timeoutMs,
            },
            message: `Command timed out after ${timeoutMs}ms.`,
          },
          target: options.target,
        }), renderTimeoutHuman, { force: true }))
      }, timeoutMs)
    })

    return await withSignalCancellation(options, () => Promise.race([
      options.run().then(result => storeIdempotentResult(options.action, options.target, result)),
      timeoutPromise,
    ]))
  }
  finally {
    if (timeoutId)
      clearTimeout(timeoutId)
  }
}

function renderTimeoutHuman(result: Pick<CommandResult, 'error'>): void {
  if (result.error)
    console.error(pc.red(result.error.message))
}

async function replayIdempotentResult<T>(action: string, target?: CommandTarget): Promise<CommandResult<T> | undefined> {
  const context = getCliContext()
  if (!context.idempotencyKey)
    return undefined

  const record = await loadIdempotencyRecord(context.idempotencyKey)
  if (!record)
    return undefined

  if (record.action !== action) {
    return emitCommandResult(createErrorResult<T>({
      action,
      error: {
        code: 'INVALID_ARGUMENT',
        details: {
          existingAction: record.action,
          idempotencyKey: context.idempotencyKey,
        },
        message: `Idempotency key ${context.idempotencyKey} was already used for ${record.action}.`,
      },
      target,
    }), renderTimeoutHuman, { force: true })
  }

  const replayedResult = {
    ...record.result,
    meta: {
      ...record.result.meta,
      mode: context.outputMode,
      runId: context.runId,
      timestamp: new Date().toISOString(),
    },
  } as CommandResult<T>

  emitCommandResult(replayedResult, renderTimeoutHuman, { force: true })
  return replayedResult
}

async function storeIdempotentResult<T>(action: string, target: CommandTarget | undefined, result: CommandResult<T>): Promise<CommandResult<T>> {
  const context = getCliContext()
  if (context.idempotencyKey)
    await saveIdempotencyRecord(context.idempotencyKey, { action, result, target })

  return result
}

async function withSignalCancellation<T>(options: ExecuteCommandOptions<T>, run: () => Promise<CommandResult<T>>): Promise<CommandResult<T>> {
  let cleanup: (() => void) | undefined

  try {
    const signalPromise = new Promise<CommandResult<T>>((resolve) => {
      const handleSignal = (signal: NodeJS.Signals): void => {
        cancelCliContextOperations()
        emitCommandEvent({
          action: options.action,
          data: {
            reason: 'signal',
            signal,
          },
          target: options.target,
          type: 'cancelled',
        }, { force: true })

        resolve(emitCommandResult(createErrorResult<T>({
          action: options.action,
          error: {
            code: 'CANCELLED',
            details: {
              signal,
            },
            message: `Command cancelled by ${signal}.`,
          },
          target: options.target,
        }), renderTimeoutHuman, { force: true }))
      }

      const sigintHandler = (): void => handleSignal('SIGINT')
      const sigtermHandler = (): void => handleSignal('SIGTERM')
      process.once('SIGINT', sigintHandler)
      process.once('SIGTERM', sigtermHandler)
      cleanup = (): void => {
        process.off('SIGINT', sigintHandler)
        process.off('SIGTERM', sigtermHandler)
      }
    })

    return await Promise.race([run(), signalPromise])
  }
  finally {
    cleanup?.()
  }
}
