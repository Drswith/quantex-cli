import type { CommandResult, CommandTarget } from './output/types'
import { cancelCliContextOperations, getCliContext } from './cli-context'
import { createErrorResult, emitCommandEvent, emitCommandResult } from './output'
import { maybeRenderSelfUpdateNotice } from './self/update-notice'
import { executeWithRuntimeDeadline, executeWithSignalCancellation } from './services/runtime-cancellation'
import {
  persistIdempotentExecution,
  resolveIdempotentExecution,
  type RuntimeIdempotencyInvocation,
} from './services/runtime-idempotency'
import { getStateFilePath, StateFileError } from './state'
import { pc } from './utils/color'
import { createStateReadError } from './utils/lifecycle-errors'

interface ExecuteCommandOptions<T> {
  action: string
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}

export async function executeCommandWithRuntime<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  try {
    return await executeCommandWithRuntimeInternal(options)
  } catch (error) {
    if (error instanceof StateFileError) return resolveStateReadError(options, error)

    throw error
  }
}

async function executeCommandWithRuntimeInternal<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  const idempotencyInvocation = createIdempotencyInvocation(options.action, options.target)
  const idempotencyOutcome = await resolveIdempotentExecution<T>(idempotencyInvocation)

  if (idempotencyOutcome.kind === 'conflict') {
    return emitIdempotencyConflict(options, idempotencyOutcome.existingAction, idempotencyOutcome.idempotencyKey)
  }

  if (idempotencyOutcome.kind === 'replay') {
    emitCommandResult(idempotencyOutcome.result, renderRuntimeHuman, { force: true })
    return idempotencyOutcome.result
  }

  const context = getCliContext()
  const signalOutcome = await executeWithSignalCancellation({
    cancelOperations: cancelCliContextOperations,
    isCancelled: () => Boolean(getCliContext().cancelled),
    run: async () => {
      const deadlineOutcome = await executeWithRuntimeDeadline({
        cancelOperations: cancelCliContextOperations,
        isCancelled: () => Boolean(getCliContext().cancelled),
        run: options.run,
        timeoutMs: context.timeoutMs,
      })

      const result =
        deadlineOutcome.kind === 'completed'
          ? deadlineOutcome.result
          : emitTimeoutCancellation(options, deadlineOutcome.timeoutMs)

      return finalizeRun(idempotencyInvocation, result)
    },
  })

  if (signalOutcome.kind === 'signal-cancelled') {
    return emitSignalCancellation(options, signalOutcome.signal)
  }

  return signalOutcome.result
}

function createIdempotencyInvocation(action: string, target?: CommandTarget): RuntimeIdempotencyInvocation {
  const context = getCliContext()
  return {
    action,
    dryRun: Boolean(context.dryRun),
    idempotencyKey: context.idempotencyKey,
    outputMode: context.outputMode,
    runId: context.runId,
    target,
  }
}

async function finalizeRun<T>(
  invocation: RuntimeIdempotencyInvocation,
  result: CommandResult<T>,
): Promise<CommandResult<T>> {
  await persistIdempotentExecution(invocation, result)

  try {
    await maybeRenderSelfUpdateNotice({
      action: invocation.action,
      ok: result.ok,
    })
  } catch {
    // Passive reminders must never fail the primary command path.
  }

  return result
}

function emitIdempotencyConflict<T>(
  options: ExecuteCommandOptions<T>,
  existingAction: string,
  idempotencyKey: string,
): CommandResult<T> {
  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      error: {
        code: 'INVALID_ARGUMENT',
        details: {
          existingAction,
          idempotencyKey,
        },
        message: `Idempotency key ${idempotencyKey} was already used for ${existingAction}.`,
      },
      target: options.target,
    }),
    renderRuntimeHuman,
    { force: true },
  )
}

function resolveStateReadError<T>(options: ExecuteCommandOptions<T>, error: StateFileError): CommandResult<T> {
  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      ...createStateReadError(error, getStateFilePath(), options.target),
    }),
    renderRuntimeHuman,
  )
}

function emitTimeoutCancellation<T>(options: ExecuteCommandOptions<T>, timeoutMs: number): CommandResult<T> {
  emitCommandEvent(
    {
      action: options.action,
      data: {
        reason: 'timeout',
        timeoutMs,
      },
      target: options.target,
      type: 'cancelled',
    },
    { force: true },
  )

  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      error: {
        code: 'TIMEOUT',
        details: {
          timeoutMs,
        },
        message: `Command timed out after ${timeoutMs}ms.`,
      },
      target: options.target,
    }),
    renderRuntimeHuman,
    { force: true },
  )
}

function emitSignalCancellation<T>(options: ExecuteCommandOptions<T>, signal: 'SIGINT' | 'SIGTERM'): CommandResult<T> {
  emitCommandEvent(
    {
      action: options.action,
      data: {
        reason: 'signal',
        signal,
      },
      target: options.target,
      type: 'cancelled',
    },
    { force: true },
  )

  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      error: {
        code: 'CANCELLED',
        details: {
          signal,
        },
        message: `Command cancelled by ${signal}.`,
      },
      target: options.target,
    }),
    renderRuntimeHuman,
    { force: true },
  )
}

function renderRuntimeHuman(result: Pick<CommandResult, 'error'>): void {
  if (result.error) console.error(pc.red(result.error.message))
}
