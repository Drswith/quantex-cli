import type {
  LifecycleObservation,
  LifecyclePlan,
  LifecyclePostcondition,
  LifecycleReceipt,
  LifecycleVerification,
} from '../../src/lifecycle'
import { describe, expect, it, vi } from 'vitest'
import { reconcileVerifiedMutation } from '../../src/lifecycle/reconcile'

describe('reconcileVerifiedMutation', () => {
  it('executes, verifies, and records a receipt in order', async () => {
    const calls: string[] = []
    const receipt = verifiedReceipt()

    const result = await reconcileVerifiedMutation({
      compensate: async () => {
        calls.push('compensate')
      },
      createReceipt: () => receipt,
      execute: async () => {
        calls.push('execute')
        return { kind: 'success', value: { changed: true, value: 'installed' } }
      },
      plan: installPlan(),
      recordReceipt: async () => {
        calls.push('record')
      },
      verify: async () => {
        calls.push('verify')
        return satisfiedVerification()
      },
    })

    expect(result).toEqual({
      kind: 'success',
      value: {
        changed: true,
        receipt,
        value: 'installed',
        verification: satisfiedVerification(),
      },
    })
    expect(calls).toEqual(['execute', 'verify', 'record'])
  })

  it('does not record requested state when verification is unsatisfied', async () => {
    const recordReceipt = vi.fn()
    const compensate = vi.fn()

    const result = await reconcileVerifiedMutation({
      compensate,
      createReceipt: () => verifiedReceipt(),
      execute: async () => ({ kind: 'success', value: { changed: true, value: 'installed' } }),
      plan: installPlan(),
      recordReceipt,
      verify: async () => ({
        kind: 'unsatisfied',
        observation: absentObservation,
        postcondition: packagePresent,
        reason: 'binary-not-found',
      }),
    })

    expect(result).toEqual({ kind: 'failed', reason: 'binary-not-found', retryable: false })
    expect(recordReceipt).not.toHaveBeenCalled()
    expect(compensate).toHaveBeenCalledWith({ changed: true, value: 'installed' })
  })

  it('compensates state and reports failure when receipt persistence fails', async () => {
    const compensate = vi.fn()

    const result = await reconcileVerifiedMutation({
      compensate,
      createReceipt: () => verifiedReceipt(),
      execute: async () => ({ kind: 'success', value: { changed: true, value: 'installed' } }),
      plan: installPlan(),
      recordReceipt: async () => {
        throw new Error('disk-full')
      },
      verify: async () => satisfiedVerification(),
    })

    expect(result).toEqual({ kind: 'failed', reason: 'receipt-write-failed', retryable: true })
    expect(compensate).toHaveBeenCalledWith({ changed: true, value: 'installed' })
  })

  it('does not verify or record after execution failure', async () => {
    const verify = vi.fn()
    const recordReceipt = vi.fn()

    const result = await reconcileVerifiedMutation({
      createReceipt: () => verifiedReceipt(),
      execute: async () => ({ kind: 'cancelled', reason: 'signal' }),
      plan: installPlan(),
      recordReceipt,
      verify,
    })

    expect(result).toEqual({ kind: 'cancelled', reason: 'signal' })
    expect(verify).not.toHaveBeenCalled()
    expect(recordReceipt).not.toHaveBeenCalled()
  })

  it('compensates state when the verifier throws before producing evidence', async () => {
    const compensate = vi.fn()

    const result = await reconcileVerifiedMutation({
      compensate,
      createReceipt: () => verifiedReceipt(),
      execute: async () => ({ kind: 'success', value: { changed: true, value: 'installed' } }),
      plan: installPlan(),
      recordReceipt: vi.fn(),
      verify: async () => {
        throw new Error('probe-crashed')
      },
    })

    expect(result).toEqual({ kind: 'failed', reason: 'verification-failed', retryable: true })
    expect(compensate).toHaveBeenCalledWith({ changed: true, value: 'installed' })
  })
})

const packagePresent: LifecyclePostcondition = {
  kind: 'package-present',
  providerId: 'bun',
  targetId: '@openai/codex',
}

const absentObservation: LifecycleObservation = {
  drift: { kind: 'recorded-absent' },
  kind: 'absent',
  targetId: 'codex',
}

function installPlan(): LifecyclePlan {
  return {
    id: 'install-codex',
    intent: { kind: 'ensure', targetId: 'codex' },
    kind: 'lifecycle-plan',
    observation: absentObservation,
    steps: [],
  }
}

function satisfiedVerification(): LifecycleVerification {
  return {
    kind: 'satisfied',
    observation: {
      drift: { kind: 'none' },
      kind: 'present',
      providerId: 'bun',
      providerTargetId: '@openai/codex',
      targetId: 'codex',
    },
    postcondition: packagePresent,
  }
}

function verifiedReceipt(): LifecycleReceipt {
  return {
    kind: 'lifecycle-receipt',
    providerId: 'bun',
    providerTargetId: '@openai/codex',
    schemaVersion: 1,
    targetId: 'codex',
    verifiedAt: '2026-07-12T02:00:00.000Z',
  }
}
