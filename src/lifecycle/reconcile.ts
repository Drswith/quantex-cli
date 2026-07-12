import type { LifecycleOutcome, LifecyclePlan, LifecycleReceipt, LifecycleVerification } from './model'

export interface MutationExecution<T> {
  readonly changed: boolean
  readonly value: T
}

export interface VerifiedMutation<T> extends MutationExecution<T> {
  readonly receipt: LifecycleReceipt
  readonly verification: Extract<LifecycleVerification, { kind: 'satisfied' }>
}

export interface ReconcileVerifiedMutationInput<T> {
  readonly compensate?: (execution: MutationExecution<T>) => Promise<void>
  readonly createReceipt: (
    verification: Extract<LifecycleVerification, { kind: 'satisfied' }>,
    execution: MutationExecution<T>,
  ) => LifecycleReceipt
  readonly execute: () => Promise<LifecycleOutcome<MutationExecution<T>>>
  readonly plan: LifecyclePlan
  readonly recordReceipt: (receipt: LifecycleReceipt) => Promise<void>
  readonly verify: (execution: MutationExecution<T>, plan: LifecyclePlan) => Promise<LifecycleVerification>
}

export async function reconcileVerifiedMutation<T>(
  input: ReconcileVerifiedMutationInput<T>,
): Promise<LifecycleOutcome<VerifiedMutation<T>>> {
  const execution = await input.execute()
  if (execution.kind !== 'success') return execution

  let verification: LifecycleVerification
  try {
    verification = await input.verify(execution.value, input.plan)
  } catch {
    await compensateSafely(input, execution.value)
    return { kind: 'failed', reason: 'verification-failed', retryable: true }
  }
  if (verification.kind !== 'satisfied') {
    await compensateSafely(input, execution.value)
    return verification.kind === 'indeterminate'
      ? { kind: 'indeterminate', reason: verification.reason }
      : { kind: 'failed', reason: verification.reason, retryable: false }
  }

  const receipt = input.createReceipt(verification, execution.value)
  try {
    await input.recordReceipt(receipt)
  } catch {
    await compensateSafely(input, execution.value)
    return { kind: 'failed', reason: 'receipt-write-failed', retryable: true }
  }

  return {
    kind: 'success',
    value: {
      ...execution.value,
      receipt,
      verification,
    },
  }
}

async function compensateSafely<T>(
  input: ReconcileVerifiedMutationInput<T>,
  execution: MutationExecution<T>,
): Promise<void> {
  if (!execution.changed || !input.compensate) return
  try {
    await input.compensate(execution)
  } catch {
    // Preserve the primary reconciliation failure; compensation remains best effort.
  }
}
