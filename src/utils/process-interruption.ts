export class ProcessInterruptionError extends Error {
  readonly kind: 'cancelled' | 'timed-out'
  readonly reason?: string
  readonly timeoutMs?: number

  constructor(input: { kind: 'cancelled'; reason?: string } | { kind: 'timed-out'; timeoutMs: number }) {
    super(input.kind === 'timed-out' ? `Process timed out after ${input.timeoutMs}ms.` : 'Process was cancelled.')
    this.name = 'ProcessInterruptionError'
    this.kind = input.kind
    if (input.kind === 'timed-out') this.timeoutMs = input.timeoutMs
    else this.reason = input.reason
  }
}

export function isProcessInterruptionError(error: unknown): error is ProcessInterruptionError {
  return error instanceof ProcessInterruptionError
}
