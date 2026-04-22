import type { CommandResult, CommandTarget } from './output/types'
import pc from 'picocolors'
import { getCliContext, markCliContextCancelled } from './cli-context'
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
    return storeIdempotentResult(options.action, options.target, await options.run())

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timeoutPromise = new Promise<CommandResult<T>>((resolve) => {
      timeoutId = setTimeout(() => {
        markCliContextCancelled()
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

    return await Promise.race([
      options.run().then(result => storeIdempotentResult(options.action, options.target, result)),
      timeoutPromise,
    ])
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
