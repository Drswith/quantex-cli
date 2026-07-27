import type { ProviderOperationContext, ProviderOutcome } from '../providers'
import { isProcessInterruptionError, runCommandWithContext } from '../utils/child-process'

export type PackageMutationOutcome = ProviderOutcome<void>

export async function runPackageMutationOutcome(
  command: readonly string[],
  context: ProviderOperationContext,
  description: string,
): Promise<PackageMutationOutcome> {
  try {
    const exitCode = await runCommandWithContext(command, context, { detached: process.platform !== 'win32' })
    return exitCode === 0
      ? { kind: 'success', value: undefined }
      : {
          command,
          exitCode,
          kind: 'failed',
          reason: `${description} with exit code ${exitCode}`,
          retryable: false,
        }
  } catch (error) {
    if (isProcessInterruptionError(error)) {
      return error.kind === 'timed-out'
        ? { kind: 'timed-out', timeoutMs: error.timeoutMs ?? context.timeoutMs ?? 0 }
        : { kind: 'cancelled', ...(error.reason ? { reason: error.reason } : {}) }
    }
    return {
      command,
      kind: 'failed',
      reason: `${description}: ${errorReason(error)}`,
      retryable: false,
    }
  }
}

export async function runPackageMutationSequence(
  commands: readonly (readonly string[])[],
  context: ProviderOperationContext,
  description: string,
): Promise<PackageMutationOutcome> {
  for (const command of commands) {
    const outcome = await runPackageMutationOutcome(command, context, description)
    if (outcome.kind !== 'success') return outcome
  }
  return { kind: 'success', value: undefined }
}

function errorReason(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : String(error)
}
