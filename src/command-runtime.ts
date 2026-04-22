import type { CommandResult, CommandTarget } from './output/types'
import pc from 'picocolors'
import { getCliContext, markCliContextCancelled } from './cli-context'
import { createErrorResult, emitCommandEvent, emitCommandResult } from './output'

interface ExecuteCommandOptions<T> {
  action: string
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}

export async function executeCommandWithRuntime<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  const timeoutMs = getCliContext().timeoutMs
  if (timeoutMs === undefined)
    return options.run()

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

    return await Promise.race([options.run(), timeoutPromise])
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
