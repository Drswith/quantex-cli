import type { LifecycleObservation, LifecycleReceipt } from '../../src/lifecycle'
import type { ProviderAdapter, ProviderOperation, ProviderOutcome, ProviderResolvedVersion } from '../../src/providers'
import { describe, expect, it, vi } from 'vitest'
import { planLifecycleUpdate } from '../../src/lifecycle/update-planner'
import {
  executeLifecycleUpdateBatch,
  executeSingleAgentLifecycleUpdate,
  planRegisteredAgentUpdates,
  planSingleAgentLifecycleUpdate,
  type LifecycleUpdateBatchExecutionPorts,
  type LifecycleUpdateBatchPlanningPorts,
  type LifecycleUpdateServicePorts,
  type SingleAgentLifecycleUpdatePlan,
} from '../../src/services/lifecycle-updates'

describe('registered-agent lifecycle update batch planning', () => {
  it('plans equivalent registered inputs with one deterministic resolved identity', async () => {
    const fixtures: BatchAgentFixtures = {
      alpha: { providerId: 'npm', targetVersion: '2.0.0' },
      beta: { providerId: 'bun', targetVersion: '3.0.0' },
      gamma: { providerId: 'npm', targetVersion: '2.5.0' },
    }
    const forward = createBatchHarness(['gamma', 'alpha', 'beta', 'alpha'], fixtures)
    const reversed = createBatchHarness(['beta', 'alpha', 'gamma'], fixtures)

    const forwardPlan = await planRegisteredAgentUpdates(forward.ports)
    const reversedPlan = await planRegisteredAgentUpdates(reversed.ports)

    expect(forwardPlan.targets.map(target => target.agentName)).toEqual(['alpha', 'beta', 'gamma'])
    expect(forwardPlan.targets.map(target => target.id)).toEqual(reversedPlan.targets.map(target => target.id))
    expect(batchTargetSummary(forwardPlan.targets)).toEqual(batchTargetSummary(reversedPlan.targets))
    expect(batchTargetSummary(forwardPlan.targets)).toEqual([
      { agentName: 'alpha', decision: 'upgrade', planId: 'update-alpha' },
      { agentName: 'beta', decision: 'upgrade', planId: 'update-beta' },
      { agentName: 'gamma', decision: 'upgrade', planId: 'update-gamma' },
    ])
    expect(forwardPlan.providerBuckets.map(bucket => bucket.providerId)).toEqual(['bun', 'npm'])
    expect(forwardPlan.providerBuckets.map(bucket => bucket.targets.map(target => target.agentName))).toEqual([
      ['beta'],
      ['alpha', 'gamma'],
    ])
    expect(forwardPlan.providerBuckets.map(bucket => bucket.id)).toEqual(
      reversedPlan.providerBuckets.map(bucket => bucket.id),
    )
    expect(forwardPlan.id).toBe(reversedPlan.id)
    expect(forwardPlan.resolvedPlanId).toBe(reversedPlan.resolvedPlanId)
    expect(new Set(forwardPlan.targets.map(target => target.id)).size).toBe(3)
    expect(forward.update).not.toHaveBeenCalled()
    expect(forward.writeReceipt).not.toHaveBeenCalled()
  })

  it('preserves every non-upgrade planning outcome outside automatic provider buckets', async () => {
    const harness = createBatchHarness(
      [
        'up-to-date',
        'unknown',
        'timed-out',
        'provider-failed',
        'manual',
        'indeterminate',
        'cancelled',
        'blocked',
        'alpha',
      ],
      {
        alpha: { providerId: 'npm', targetVersion: '2.0.0' },
        blocked: {
          observation: presentBatchObservation('blocked', 'npm', '1.0.0', { drift: { kind: 'conflicting-source' } }),
          providerId: 'npm',
          targetVersion: '2.0.0',
        },
        cancelled: {
          providerId: 'npm',
          resolveOutcome: { kind: 'cancelled', reason: 'provider cancellation' },
        },
        indeterminate: { installedVersion: 'development', providerId: 'npm', targetVersion: 'next' },
        manual: { providerId: 'bun', targetVersion: '2.0.0' },
        'provider-failed': {
          providerId: 'npm',
          resolveOutcome: { kind: 'failed', reason: 'registry unavailable', retryable: true },
        },
        'timed-out': { providerId: 'npm', resolveOutcome: { kind: 'timed-out', timeoutMs: 25 } },
        unknown: { missing: true, providerId: 'npm' },
        'up-to-date': { installedVersion: '2.0.0', providerId: 'npm', targetVersion: '2.0.0' },
      },
      { bun: ['observe', 'resolve-latest-version', 'update'] },
    )

    const plan = await planRegisteredAgentUpdates(harness.ports)

    expect(plan.targets.map(target => [target.agentName, batchOutcome(target)])).toEqual([
      ['alpha', 'upgrade'],
      ['blocked', 'blocked'],
      ['cancelled', 'cancelled'],
      ['indeterminate', 'indeterminate'],
      ['manual', 'manual-required'],
      ['provider-failed', 'provider-failed'],
      ['timed-out', 'timed-out'],
      ['unknown', 'unknown-agent'],
      ['up-to-date', 'up-to-date'],
    ])
    expect(plan.providerBuckets.map(bucket => bucket.targets.map(target => target.agentName))).toEqual([['alpha']])
    expect(plan.targets.find(target => target.agentName === 'cancelled')?.outcome).toMatchObject({
      kind: 'cancelled',
      reason: 'provider cancellation',
    })
    expect(plan.targets.find(target => target.agentName === 'provider-failed')?.outcome).toMatchObject({
      kind: 'provider-failed',
      providerOutcome: { kind: 'failed' },
    })
    expect(plan.targets.find(target => target.agentName === 'timed-out')?.outcome).toMatchObject({
      kind: 'timed-out',
      timeoutMs: 25,
    })
    expect(harness.update).not.toHaveBeenCalled()
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('changes resolved identity when blocked, cancelled, or unknown-agent meaning changes', async () => {
    const conflicting = createBatchHarness(['alpha'], {
      alpha: {
        observation: presentBatchObservation('alpha', 'npm', '1.0.0', { drift: { kind: 'conflicting-source' } }),
        providerId: 'npm',
      },
    })
    const unsupported = createBatchHarness(['alpha'], {
      alpha: { canResolveLatestVersion: false, providerId: 'npm' },
    })
    const cancelledByUser = createBatchHarness(['alpha'], {
      alpha: { providerId: 'npm', resolveOutcome: { kind: 'cancelled', reason: 'user cancelled' } },
    })
    const cancelledByProvider = createBatchHarness(['alpha'], {
      alpha: { providerId: 'npm', resolveOutcome: { kind: 'cancelled', reason: 'provider cancelled' } },
    })
    const unknownAlpha = createBatchHarness(['alpha'], { alpha: { missing: true, providerId: 'npm' } })
    const unknownBeta = createBatchHarness(['beta'], { beta: { missing: true, providerId: 'npm' } })

    await expectBatchIdentityToDiffer(conflicting, unsupported)
    await expectBatchIdentityToDiffer(cancelledByUser, cancelledByProvider)
    await expectBatchIdentityToDiffer(unknownAlpha, unknownBeta)
  })

  it('includes the stable blocked category in resolved target identity', async () => {
    const unsafeSource = createBatchHarness(['alpha'], {
      alpha: {
        observation: presentBatchObservation('alpha', 'npm', '1.0.0', { drift: { kind: 'conflicting-source' } }),
        providerId: 'npm',
      },
    })
    const manualRequired = createBatchHarness(['alpha'], {
      alpha: { canResolveLatestVersion: false, providerId: 'npm' },
    })

    const unsafePlan = await planRegisteredAgentUpdates(unsafeSource.ports)
    const manualPlan = await planRegisteredAgentUpdates(manualRequired.ports)

    expect(unsafePlan.targets[0]?.id).toContain('category=unsafe-source')
    expect(manualPlan.targets[0]?.id).toContain('category=manual-required')
    expect(unsafePlan.resolvedPlanId).not.toBe(manualPlan.resolvedPlanId)
  })

  it('omits a catalog-only target when neither live nor persisted evidence says it is installed', async () => {
    const harness = createBatchHarness(['genie'], { genie: { providerId: 'npm' } })
    const ports: LifecycleUpdateBatchPlanningPorts = {
      ...harness.ports,
      observe: async () => ({
        ...batchObservationResult('genie', { providerId: 'npm' }),
        executable: { present: false },
        observation: {
          drift: { kind: 'indeterminate', reason: 'provider unavailable' },
          kind: 'indeterminate',
          reason: 'provider unavailable',
          targetId: 'genie',
        },
      }),
    }

    const plan = await planRegisteredAgentUpdates(ports)

    expect(plan.targets).toEqual([])
    expect(plan.providerBuckets).toEqual([])
  })

  it('preserves stale persisted state as a non-automatic reconciliation target', async () => {
    const harness = createBatchHarness(['jcode'], { jcode: { providerId: 'npm' } })
    const ports: LifecycleUpdateBatchPlanningPorts = {
      ...harness.ports,
      observe: async () => ({
        ...batchObservationResult('jcode', { providerId: 'npm' }),
        executable: { present: false },
        installedState: {
          agentName: 'jcode',
          command: 'curl https://example.com/jcode | bash',
          installType: 'script',
        },
        observation: {
          drift: { kind: 'recorded-absent' },
          kind: 'absent',
          targetId: 'jcode',
        },
      }),
    }

    const plan = await planRegisteredAgentUpdates(ports)

    expect(plan.targets).toHaveLength(1)
    expect(plan.targets[0]?.outcome).toMatchObject({ category: 'stale-state', kind: 'blocked' })
    expect(plan.providerBuckets).toEqual([])
  })

  it.each(providerOutcomeIdentityCases)(
    'changes resolved identity when provider outcome %s changes',
    async (_field, before, after) => {
      const first = createBatchHarness(['alpha'], { alpha: { providerId: 'npm', resolveOutcome: before } })
      const second = createBatchHarness(['alpha'], { alpha: { providerId: 'npm', resolveOutcome: after } })

      await expectBatchIdentityToDiffer(first, second)
    },
  )
})

describe('registered-agent lifecycle update batch execution', () => {
  it('preserves mixed typed outcomes in canonical target order', async () => {
    const harness = createBatchExecutionHarness(
      ['zeta', 'gamma', 'epsilon', 'delta', 'beta', 'alpha'],
      {
        alpha: { providerId: 'npm', targetVersion: '2.0.0' },
        beta: { installedVersion: '2.0.0', providerId: 'npm', targetVersion: '2.0.0' },
        delta: {
          providerId: 'npm',
          targetVersion: '2.0.0',
          updateOutcome: { kind: 'failed', reason: 'registry rejected update', retryable: true },
        },
        epsilon: { afterVersion: '1.0.0', providerId: 'npm', targetVersion: '2.0.0' },
        gamma: { providerId: 'bun', targetVersion: '2.0.0' },
        zeta: { providerId: 'npm', targetVersion: '2.0.0', updateError: new TestLockError('busy', '/locks/zeta') },
      },
      { bun: ['observe', 'resolve-latest-version', 'update'] },
    )
    const plan = await planRegisteredAgentUpdates(harness.ports)

    const outcome = await executeLifecycleUpdateBatch(plan, harness.ports)

    expect(outcome.results.map(result => result.agentName)).toEqual([
      'alpha',
      'beta',
      'delta',
      'epsilon',
      'gamma',
      'zeta',
    ])
    expect(outcome.results.map(result => (result.execution ? result.execution.kind : result.planning.kind))).toEqual([
      'updated',
      'not-executed',
      'provider-failed',
      'verification-failed',
      'not-executed',
      'locked',
    ])
    expect(outcome.results.at(-1)?.execution).toMatchObject({
      kind: 'locked',
      reason: 'busy',
      resource: '/locks/zeta',
    })
    expect(outcome.cancellationRemainder).toEqual([])
    expect(outcome.success).toBe(false)
  })

  it('represents every planned target as cancellation remainder when aborted before execution', async () => {
    const controller = new AbortController()
    const harness = createBatchExecutionHarness(
      ['gamma', 'alpha', 'beta'],
      {
        alpha: { providerId: 'npm', targetVersion: '2.0.0' },
        beta: { providerId: 'npm', targetVersion: '2.0.0' },
        gamma: { providerId: 'npm', targetVersion: '2.0.0' },
      },
      {},
      controller,
    )
    const plan = await planRegisteredAgentUpdates(harness.ports)
    controller.abort('cancelled-before-execution')

    const outcome = await executeLifecycleUpdateBatch(plan, harness.ports)

    expect(outcome.results).toEqual([])
    expect(outcome.cancellationRemainder.map(target => target.agentName)).toEqual(['alpha', 'beta', 'gamma'])
    expect(outcome.cancellationRemainder.every(target => target.reason === 'cancelled-before-execution')).toBe(true)
    expect(harness.updatedAgentNames).toEqual([])
    expect(outcome.success).toBe(false)
  })

  it('stops scheduling mutations after cancellation and preserves completed work plus canonical remainder', async () => {
    const controller = new AbortController()
    const harness = createBatchExecutionHarness(
      ['gamma', 'beta', 'alpha'],
      {
        alpha: { abortAfterUpdate: 'cancelled-during-alpha', providerId: 'npm', targetVersion: '2.0.0' },
        beta: { providerId: 'npm', targetVersion: '2.0.0' },
        gamma: { providerId: 'npm', targetVersion: '2.0.0' },
      },
      {},
      controller,
    )
    const plan = await planRegisteredAgentUpdates(harness.ports)

    const outcome = await executeLifecycleUpdateBatch(plan, harness.ports)

    expect(outcome.results.map(result => [result.agentName, result.execution?.kind])).toEqual([['alpha', 'cancelled']])
    expect(outcome.cancellationRemainder.map(target => target.agentName)).toEqual(['beta', 'gamma'])
    expect(harness.updatedAgentNames).toEqual(['alpha'])
    expect(outcome.success).toBe(false)
  })

  it('contains unexpected target failures and continues preserving later canonical results', async () => {
    const harness = createBatchExecutionHarness(['beta', 'alpha'], {
      alpha: { providerId: 'npm', targetVersion: '2.0.0', updateError: new Error('adapter exploded') },
      beta: { providerId: 'npm', targetVersion: '2.0.0' },
    })
    const plan = await planRegisteredAgentUpdates(harness.ports)

    const outcome = await executeLifecycleUpdateBatch(plan, harness.ports)

    expect(outcome.results.map(result => [result.agentName, result.execution?.kind])).toEqual([
      ['alpha', 'unexpected-failure'],
      ['beta', 'updated'],
    ])
    expect(outcome.results[0]?.execution).toMatchObject({ reason: 'adapter exploded' })
    expect(outcome.success).toBe(false)
  })
})

describe('single-agent lifecycle update application service', () => {
  it('plans against the confirmed recorded provider binding', async () => {
    const harness = createHarness()

    const result = await planSingleAgentLifecycleUpdate('alpha', harness.ports)

    expect(result.kind).toBe('planned')
    if (result.kind !== 'planned') return
    expect(result.planned.binding).toEqual({
      providerId: 'npm',
      target: { binaryName: 'alpha', id: '@scope/alpha', kind: 'package' },
    })
    expect(result.planned.planning.decision).toBe('upgrade')
    expect(harness.resolveLatestVersion).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ id: '@scope/alpha' }) }),
    )
  })

  it('blocks conflicting provider evidence before resolving or mutating', async () => {
    const harness = createHarness({ observation: presentObservation({ drift: { kind: 'conflicting-source' } }) })

    const result = await planSingleAgentLifecycleUpdate('alpha', harness.ports)

    expect(result).toMatchObject({
      category: 'unsafe-source',
      kind: 'blocked',
      reason: expect.stringContaining('source'),
    })
    expect(harness.resolveLatestVersion).not.toHaveBeenCalled()
    expect(harness.update).not.toHaveBeenCalled()
  })

  it('blocks a live binding that differs from normalized persisted evidence even without drift', async () => {
    const harness = createHarness({
      persistedBinding: { providerId: 'npm', target: { id: '@scope/other', kind: 'package' } },
    })

    const result = await planSingleAgentLifecycleUpdate('alpha', harness.ports)

    expect(result).toMatchObject({
      category: 'unsafe-source',
      kind: 'blocked',
      reason: expect.stringContaining('source'),
    })
    expect(harness.resolveLatestVersion).not.toHaveBeenCalled()
  })

  it('classifies a confirmed binding without target resolution as manual-required and non-mutating', async () => {
    const harness = createHarness({ canResolveLatestVersion: false })

    const result = await planSingleAgentLifecycleUpdate('alpha', harness.ports)

    expect(result).toMatchObject({
      category: 'manual-required',
      kind: 'blocked',
      reason: expect.stringContaining('cannot resolve an update target version'),
    })
    expect(harness.resolveLatestVersion).not.toHaveBeenCalled()
    expect(harness.update).not.toHaveBeenCalled()
  })

  it('returns manual-required when the bound provider cannot verify updates', async () => {
    const harness = createHarness({ capabilities: ['observe', 'resolve-latest-version', 'update'] })

    const result = await planSingleAgentLifecycleUpdate('alpha', harness.ports)

    expect(result).toMatchObject({ kind: 'planned', planned: { planning: { decision: 'manual-required' } } })
  })

  it('does not write a receipt when the provider update fails', async () => {
    const harness = createHarness({
      updateOutcome: { kind: 'failed', reason: 'registry rejected update', retryable: true },
    })
    const planned = await requirePlanned(harness.ports)

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'provider-failed', providerOutcome: { kind: 'failed' } })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('passes the planned registry update strategy to the bound provider', async () => {
    const harness = createHarness({ updateStrategy: 'respect-semver' })
    const planned = await requirePlanned(harness.ports)
    harness.observe.mockResolvedValueOnce(observationResult({ observation: presentObservation({ version: '2.0.0' }) }))

    await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(harness.update).toHaveBeenCalledWith(
      expect.objectContaining({ options: { updateStrategy: 'respect-semver' } }),
    )
  })

  it('rejects provider success when fresh observation remains stale', async () => {
    const harness = createHarness()
    const planned = await requirePlanned(harness.ports)
    harness.observe
      .mockResolvedValueOnce(observationResult())
      .mockResolvedValueOnce(observationResult({ observation: presentObservation({ version: '1.5.0' }) }))

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'verification-failed', verification: { kind: 'unsatisfied' } })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('rejects conflicting fresh observation and executable versions after provider success', async () => {
    const harness = createHarness()
    const planned = await requirePlanned(harness.ports)
    harness.observe.mockResolvedValueOnce(
      observationResult({
        executableVersion: '1.0.0',
        observation: presentObservation({ version: '2.0.0' }),
      }),
    )

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'verification-failed', verification: { kind: 'unsatisfied' } })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('rejects semantic downgrade evidence after provider success', async () => {
    const harness = createHarness()
    const planned = await requirePlanned(harness.ports)
    harness.observe
      .mockResolvedValueOnce(observationResult())
      .mockResolvedValueOnce(observationResult({ observation: presentObservation({ version: '0.9.0' }) }))

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'verification-failed', verification: { kind: 'unsatisfied' } })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('rejects fresh conflicting-source drift even when the binding and version still match', async () => {
    const harness = createHarness()
    const planned = await requirePlanned(harness.ports)
    harness.observe.mockResolvedValueOnce(
      observationResult({
        observation: presentObservation({ drift: { kind: 'conflicting-source' }, version: '2.0.0' }),
      }),
    )

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'verification-failed', verification: { kind: 'unsatisfied' } })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it.each(['2.0.0', '2.1.0'])('persists the same binding receipt after verified version %s', async version => {
    const calls: string[] = []
    const harness = createHarness({
      onObserve: () => calls.push('observe'),
      onWriteReceipt: () => calls.push('receipt'),
    })
    const planned = await requirePlanned(harness.ports)
    calls.length = 0
    harness.observe.mockImplementationOnce(async () => {
      calls.push('observe')
      return observationResult({ observation: presentObservation({ version }) })
    })

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({
      kind: 'updated',
      receipt: {
        providerId: 'npm',
        providerTargetId: '@scope/alpha',
        providerTargetKind: 'package',
        targetId: 'alpha',
        version,
      },
      verification: { kind: 'satisfied' },
    })
    expect(calls).toEqual(['observe', 'receipt'])
  })

  it('returns a dry-run outcome without invoking the provider or writing a receipt', async () => {
    const harness = createHarness({ dryRun: true })
    const planned = await requirePlanned(harness.ports)

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result.kind).toBe('dry-run')
    expect(harness.update).not.toHaveBeenCalled()
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('returns cancellation before provider invocation', async () => {
    const controller = new AbortController()
    const harness = createHarness({ signal: controller.signal })
    const planned = await requirePlanned(harness.ports)
    controller.abort('user-cancelled')

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'cancelled' })
    expect(harness.update).not.toHaveBeenCalled()
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('does not observe or persist after cancellation races with provider success', async () => {
    const controller = new AbortController()
    const harness = createHarness({ signal: controller.signal })
    const planned = await requirePlanned(harness.ports)
    harness.update.mockImplementationOnce(async () => {
      controller.abort('cancelled-after-provider')
      return mutationSuccess()
    })
    harness.observe.mockClear()

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'cancelled', reason: 'cancelled-after-provider' })
    expect(harness.observe).not.toHaveBeenCalled()
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('holds the mutation lock through update, fresh observation, and receipt persistence', async () => {
    const calls: string[] = []
    const harness = createHarness({
      onObserve: () => calls.push('observe'),
      onUpdate: () => calls.push('update'),
      onWriteReceipt: () => calls.push('receipt'),
      withMutationLock: async run => {
        calls.push('lock:start')
        const result = await run()
        calls.push('lock:end')
        return result
      },
    })
    const planned = await requirePlanned(harness.ports)
    calls.length = 0
    harness.observe.mockImplementationOnce(async () => {
      calls.push('observe')
      return observationResult({ observation: presentObservation({ version: '2.0.0' }) })
    })

    await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(calls).toEqual(['lock:start', 'update', 'observe', 'receipt', 'lock:end'])
  })

  it('preserves provider timeout outcomes and writes no receipt', async () => {
    const harness = createHarness({ updateOutcome: { kind: 'timed-out', timeoutMs: 25 }, timeoutMs: 25 })
    const planned = await requirePlanned(harness.ports)

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'timed-out', timeoutMs: 25 })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })

  it('reports receipt persistence failure only after successful verification', async () => {
    const harness = createHarness({ receiptError: new Error('disk full') })
    const planned = await requirePlanned(harness.ports)
    harness.observe.mockResolvedValueOnce(observationResult({ observation: presentObservation({ version: '2.0.0' }) }))

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({
      kind: 'receipt-failed',
      reason: expect.stringContaining('disk full'),
      verification: { kind: 'satisfied' },
    })
    expect(harness.writeReceipt).toHaveBeenCalledTimes(1)
  })

  it('uses the recorded self-update command for a tracked script install', async () => {
    const harness = createSelfUpdateHarness({ afterVersion: '2.0.0' })
    const planned = await requirePlanned(harness.ports)

    expect(planned).toMatchObject({
      beforeVersion: '1.0.0',
      commands: [['alpha', 'update']],
      strategy: 'self-update',
    })
    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'updated', receipt: { version: '2.0.0' } })
    expect(harness.executeSelfUpdate).toHaveBeenCalledOnce()
    expect(harness.resolveLatestVersion).not.toHaveBeenCalled()
    expect(harness.writeReceipt).toHaveBeenCalledOnce()
  })

  it('reports a successful self-update with an unchanged version as up-to-date', async () => {
    const harness = createSelfUpdateHarness({ afterVersion: '1.0.0' })
    const planned = await requirePlanned(harness.ports)

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'up-to-date', receipt: { version: '1.0.0' } })
    expect(harness.writeReceipt).toHaveBeenCalledOnce()
  })

  it('does not persist a receipt when the tracked self-update command fails', async () => {
    const harness = createSelfUpdateHarness({
      afterVersion: '1.0.0',
      executeOutcome: { kind: 'failed', reason: 'self update failed', retryable: false },
    })
    const planned = await requirePlanned(harness.ports)

    const result = await executeSingleAgentLifecycleUpdate(planned, harness.ports)

    expect(result).toMatchObject({ kind: 'provider-failed', providerOutcome: { kind: 'failed' } })
    expect(harness.writeReceipt).not.toHaveBeenCalled()
  })
})

async function requirePlanned(ports: LifecycleUpdateServicePorts): Promise<SingleAgentLifecycleUpdatePlan> {
  const result = await planSingleAgentLifecycleUpdate('alpha', ports)
  expect(result.kind).toBe('planned')
  if (result.kind !== 'planned') throw new Error(`Expected planned result, received ${result.kind}`)
  return result.planned
}

function createHarness(
  options: {
    canResolveLatestVersion?: boolean
    capabilities?: ProviderOperation[]
    dryRun?: boolean
    observation?: LifecycleObservation
    onObserve?: () => void
    onUpdate?: () => void
    onWriteReceipt?: () => void
    persistedBinding?: {
      providerId: 'npm'
      target: { id: string; kind: 'package' }
    }
    receiptError?: Error
    signal?: AbortSignal
    timeoutMs?: number
    updateStrategy?: 'latest-major' | 'respect-semver'
    updateOutcome?: ProviderOutcome<never>
    withMutationLock?: LifecycleUpdateServicePorts['withMutationLock']
  } = {},
) {
  const resolveLatestVersion = vi.fn(
    async (): Promise<ProviderOutcome<ProviderResolvedVersion>> => ({
      kind: 'success',
      value: { version: '2.0.0' },
    }),
  )
  const update = vi.fn(async () => {
    options.onUpdate?.()
    return options.updateOutcome ?? mutationSuccess()
  })
  const adapter = {
    id: 'npm',
    observe: vi.fn(),
    availability: vi.fn(),
    ...(options.canResolveLatestVersion === false ? {} : { resolveLatestVersion }),
    update,
    verify: vi.fn(),
  } as unknown as ProviderAdapter
  const observe = vi.fn(async (_agentName?: string) => {
    options.onObserve?.()
    return observationResult({ observation: options.observation })
  })
  const writeReceipt = vi.fn(async (_receipt: LifecycleReceipt) => {
    options.onWriteReceipt?.()
    if (options.receiptError) throw options.receiptError
  })
  const ports: LifecycleUpdateServicePorts = {
    clock: () => '2026-07-13T04:00:00.000Z',
    dryRun: options.dryRun ?? false,
    observe: async agentName => {
      const result = await observe(agentName)
      return options.persistedBinding ? { ...result, persistedBinding: options.persistedBinding } : result
    },
    planLifecycleUpdate,
    providerRegistry: {
      get: () => adapter,
      getCapabilities: () => options.capabilities ?? ['observe', 'resolve-latest-version', 'update', 'verify'],
    },
    signal: options.signal ?? new AbortController().signal,
    timeoutMs: options.timeoutMs,
    updateOptions: options.updateStrategy ? { updateStrategy: options.updateStrategy } : undefined,
    withMutationLock: options.withMutationLock,
    writeReceipt,
  }
  return { observe, ports, resolveLatestVersion, update, writeReceipt }
}

function createSelfUpdateHarness(options: { afterVersion: string; executeOutcome?: ProviderOutcome<never> }) {
  const target = {
    binaryName: 'alpha',
    effect: { command: 'curl https://example.com/alpha | bash', kind: 'shell-script' as const },
    id: 'https://example.com/alpha',
    kind: 'script' as const,
  }
  let version = '1.0.0'
  const observe = vi.fn(async () => ({
    agent: {
      binaryName: 'alpha',
      displayName: 'Alpha',
      name: 'alpha',
      selfUpdate: { command: ['alpha', 'update'] },
    },
    binding: { providerId: 'script' as const, target },
    capabilities: ['observe'] as const,
    executable: { path: '/bin/alpha', present: true, version },
    installedState: {
      agentName: 'alpha',
      command: 'curl https://example.com/alpha | bash',
      installType: 'script' as const,
    },
    methods: [
      {
        command: 'curl https://example.com/alpha | bash',
        probes: ['executable-presence' as const],
        type: 'script' as const,
      },
    ],
    observation: {
      drift: { kind: 'none' as const },
      executablePath: '/bin/alpha',
      kind: 'present' as const,
      providerId: 'script',
      providerTargetId: target.id,
      providerTargetKind: 'script' as const,
      targetId: 'alpha',
      version,
    },
    persistedBinding: { providerId: 'script' as const, target },
  }))
  const executeSelfUpdate = vi.fn(async () => {
    version = options.afterVersion
    return (
      options.executeOutcome ?? {
        kind: 'success' as const,
        value: { evidence: [], target },
      }
    )
  })
  const resolveLatestVersion = vi.fn()
  const writeReceipt = vi.fn(async (_receipt: LifecycleReceipt) => undefined)
  const ports: LifecycleUpdateServicePorts = {
    clock: () => '2026-07-13T04:00:00.000Z',
    dryRun: false,
    executeSelfUpdate,
    observe,
    planLifecycleUpdate,
    providerRegistry: {
      get: () =>
        ({
          availability: vi.fn(),
          id: 'script',
          observe: vi.fn(),
          resolveLatestVersion,
        }) as unknown as ProviderAdapter,
      getCapabilities: () => ['observe'],
    },
    signal: new AbortController().signal,
    writeReceipt,
  }
  return { executeSelfUpdate, ports, resolveLatestVersion, writeReceipt }
}

function observationResult(options: { executableVersion?: string; observation?: LifecycleObservation } = {}) {
  const observation = options.observation ?? presentObservation()
  return {
    agent: { binaryName: 'alpha', displayName: 'Alpha', name: 'alpha' },
    binding: {
      providerId: 'npm' as const,
      target: { binaryName: 'alpha', id: '@scope/alpha', kind: 'package' as const },
    },
    persistedBinding: {
      providerId: 'npm' as const,
      target: { binaryName: 'alpha', id: '@scope/alpha', kind: 'package' as const },
    },
    capabilities: ['observe', 'resolve-latest-version', 'update', 'verify'] as const,
    executable: {
      path: '/bin/alpha',
      present: true,
      version: options.executableVersion ?? (observation.kind === 'present' ? observation.version : undefined),
    },
    methods: [{ packageName: '@scope/alpha', type: 'npm' as const }],
    observation,
    receipt: {
      executableName: 'alpha',
      executablePath: '/bin/alpha',
      kind: 'lifecycle-receipt' as const,
      providerId: 'npm',
      providerTargetId: '@scope/alpha',
      providerTargetKind: 'package' as const,
      schemaVersion: 1,
      targetId: 'alpha',
      verifiedAt: '2026-07-12T04:00:00.000Z',
      version: '1.0.0',
    },
  }
}

function presentObservation(overrides: Partial<Extract<LifecycleObservation, { kind: 'present' }>> = {}) {
  return {
    drift: { kind: 'none' } as const,
    executablePath: '/bin/alpha',
    kind: 'present' as const,
    providerId: 'npm',
    providerTargetId: '@scope/alpha',
    providerTargetKind: 'package' as const,
    targetId: 'alpha',
    version: '1.0.0',
    ...overrides,
  }
}

function mutationSuccess() {
  return {
    kind: 'success' as const,
    value: {
      evidence: [],
      target: { binaryName: 'alpha', id: '@scope/alpha', kind: 'package' as const },
    },
  }
}

interface BatchAgentFixture {
  readonly canResolveLatestVersion?: boolean
  readonly installedVersion?: string
  readonly missing?: boolean
  readonly observation?: LifecycleObservation
  readonly providerId: 'bun' | 'npm'
  readonly resolveOutcome?: ProviderOutcome<ProviderResolvedVersion>
  readonly targetVersion?: string
}

type BatchAgentFixtures = Readonly<Record<string, BatchAgentFixture>>

function createBatchHarness(
  registeredAgentNames: readonly string[],
  fixtures: BatchAgentFixtures,
  providerCapabilities: Partial<Record<'bun' | 'npm', readonly ProviderOperation[]>> = {},
) {
  const update = vi.fn(async () => mutationSuccess())
  const writeReceipt = vi.fn(async (_receipt: LifecycleReceipt) => undefined)
  const adapters = new Map(
    (['bun', 'npm'] as const).map(providerId => {
      const resolveLatestVersion = vi.fn(async ({ target }: { target: { id: string } }) => {
        const fixture = Object.entries(fixtures).find(
          ([agentName, candidate]) => batchProviderTargetId(agentName, candidate) === target.id,
        )?.[1]
        return (
          fixture?.resolveOutcome ?? {
            kind: 'success' as const,
            value: { version: fixture?.targetVersion ?? '2.0.0' },
          }
        )
      })
      const supportsLatestVersion = !Object.values(fixtures).some(
        fixture => fixture.providerId === providerId && fixture.canResolveLatestVersion === false,
      )
      return [
        providerId,
        {
          availability: vi.fn(),
          id: providerId,
          observe: vi.fn(),
          ...(supportsLatestVersion ? { resolveLatestVersion } : {}),
          update,
          verify: vi.fn(),
        } as unknown as ProviderAdapter,
      ] as const
    }),
  )
  const ports: LifecycleUpdateBatchPlanningPorts = {
    clock: () => '2026-07-13T04:00:00.000Z',
    dryRun: false,
    listRegisteredAgentNames: () => registeredAgentNames,
    observe: async agentName => {
      const fixture = fixtures[agentName]
      if (!fixture || fixture.missing) return undefined
      return batchObservationResult(agentName, fixture)
    },
    planLifecycleUpdate,
    providerRegistry: {
      get: providerId => adapters.get(providerId as 'bun' | 'npm'),
      getCapabilities: providerId =>
        providerCapabilities[providerId as 'bun' | 'npm'] ?? ['observe', 'resolve-latest-version', 'update', 'verify'],
    },
    signal: new AbortController().signal,
    writeReceipt,
  }
  return { ports, update, writeReceipt }
}

function batchProviderTargetId(agentName: string, fixture: BatchAgentFixture): string {
  return fixture.providerId === 'npm' ? `@scope/${agentName}` : `bun:${agentName}`
}

function batchObservationResult(agentName: string, fixture: BatchAgentFixture) {
  const target = {
    binaryName: agentName,
    id: fixture.providerId === 'npm' ? `@scope/${agentName}` : `bun:${agentName}`,
    kind: 'package' as const,
  }
  const observation =
    fixture.observation ?? presentBatchObservation(agentName, fixture.providerId, fixture.installedVersion ?? '1.0.0')
  return {
    agent: { binaryName: agentName, displayName: agentName, name: agentName },
    binding: { providerId: fixture.providerId, target },
    capabilities: ['observe', 'resolve-latest-version', 'update', 'verify'] as const,
    executable: {
      path: `/bin/${agentName}`,
      present: true,
      version: observation.kind === 'present' ? observation.version : undefined,
    },
    methods: [
      fixture.providerId === 'npm'
        ? { packageName: `@scope/${agentName}`, type: 'npm' as const }
        : { packageName: `bun:${agentName}`, type: 'bun' as const },
    ],
    observation,
    persistedBinding: { providerId: fixture.providerId, target },
  }
}

function presentBatchObservation(
  agentName: string,
  providerId: 'bun' | 'npm',
  version: string,
  overrides: Partial<Extract<LifecycleObservation, { kind: 'present' }>> = {},
): LifecycleObservation {
  return {
    drift: { kind: 'none' },
    executablePath: `/bin/${agentName}`,
    kind: 'present',
    providerId,
    providerTargetId: providerId === 'npm' ? `@scope/${agentName}` : `bun:${agentName}`,
    providerTargetKind: 'package',
    targetId: agentName,
    version,
    ...overrides,
  }
}

function batchTargetSummary(targets: Awaited<ReturnType<typeof planRegisteredAgentUpdates>>['targets']) {
  return targets.map(target => {
    if (target.outcome.kind !== 'planned') throw new Error(`Expected planned outcome for ${target.agentName}`)
    return {
      agentName: target.agentName,
      decision: target.outcome.planned.planning.decision,
      planId: target.outcome.planned.planning.plan.id,
    }
  })
}

function batchOutcome(target: Awaited<ReturnType<typeof planRegisteredAgentUpdates>>['targets'][number]): string {
  return target.outcome.kind === 'planned' ? target.outcome.planned.planning.decision : target.outcome.kind
}

class TestLockError extends Error {
  constructor(
    message: string,
    readonly resource: string,
  ) {
    super(message)
  }
}

interface BatchExecutionFixture extends BatchAgentFixture {
  readonly abortAfterUpdate?: string
  readonly afterVersion?: string
  readonly updateError?: Error
  readonly updateOutcome?: ProviderOutcome<never>
}

function createBatchExecutionHarness(
  registeredAgentNames: readonly string[],
  fixtures: Readonly<Record<string, BatchExecutionFixture>>,
  providerCapabilities: Partial<Record<'bun' | 'npm', readonly ProviderOperation[]>> = {},
  controller = new AbortController(),
) {
  const observationCounts = new Map<string, number>()
  const updatedAgentNames: string[] = []
  const fixtureForTarget = (targetId: string) =>
    Object.entries(fixtures).find(([agentName, fixture]) => batchProviderTargetId(agentName, fixture) === targetId)

  const adapters = new Map(
    (['bun', 'npm'] as const).map(providerId => {
      const adapter = {
        availability: vi.fn(),
        id: providerId,
        observe: vi.fn(),
        resolveLatestVersion: vi.fn(async ({ target }: { target: { id: string } }) => {
          const entry = fixtureForTarget(target.id)
          if (!entry) return { kind: 'indeterminate' as const, reason: `unknown target ${target.id}` }
          const [, fixture] = entry
          return (
            fixture.resolveOutcome ?? {
              kind: 'success' as const,
              value: { version: fixture.targetVersion ?? '2.0.0' },
            }
          )
        }),
        update: vi.fn(async ({ target }: { target: { id: string } }) => {
          const entry = fixtureForTarget(target.id)
          if (!entry) throw new Error(`Unknown update target ${target.id}`)
          const [agentName, fixture] = entry
          updatedAgentNames.push(agentName)
          if (fixture.updateError) throw fixture.updateError
          if (fixture.abortAfterUpdate) controller.abort(fixture.abortAfterUpdate)
          return fixture.updateOutcome ?? mutationSuccessFor(agentName, fixture.providerId)
        }),
        verify: vi.fn(),
      } as unknown as ProviderAdapter
      return [providerId, adapter] as const
    }),
  )
  const writeReceipt = vi.fn(async (_receipt: LifecycleReceipt) => undefined)
  const ports: LifecycleUpdateBatchExecutionPorts & LifecycleUpdateBatchPlanningPorts = {
    classifyMutationLockError: error =>
      error instanceof TestLockError ? { reason: error.message, resource: error.resource } : undefined,
    clock: () => '2026-07-13T04:00:00.000Z',
    dryRun: false,
    listRegisteredAgentNames: () => registeredAgentNames,
    observe: async agentName => {
      const fixture = fixtures[agentName]
      if (!fixture || fixture.missing) return undefined
      const count = (observationCounts.get(agentName) ?? 0) + 1
      observationCounts.set(agentName, count)
      if (count === 1) return batchObservationResult(agentName, fixture)
      return batchObservationResult(agentName, {
        ...fixture,
        installedVersion: fixture.afterVersion ?? fixture.targetVersion ?? fixture.installedVersion,
      })
    },
    planLifecycleUpdate,
    providerRegistry: {
      get: providerId => adapters.get(providerId as 'bun' | 'npm'),
      getCapabilities: providerId =>
        providerCapabilities[providerId as 'bun' | 'npm'] ?? ['observe', 'resolve-latest-version', 'update', 'verify'],
    },
    signal: controller.signal,
    withMutationLock: run => run(),
    writeReceipt,
  }
  return { ports, updatedAgentNames, writeReceipt }
}

function mutationSuccessFor(agentName: string, providerId: 'bun' | 'npm') {
  return {
    kind: 'success' as const,
    value: {
      evidence: [],
      target: {
        binaryName: agentName,
        id: providerId === 'npm' ? `@scope/${agentName}` : `bun:${agentName}`,
        kind: 'package' as const,
      },
    },
  }
}

const providerOutcomeIdentityCases: ReadonlyArray<
  readonly [string, ProviderOutcome<ProviderResolvedVersion>, ProviderOutcome<ProviderResolvedVersion>]
> = [
  [
    'unsupported operation',
    { kind: 'unsupported', operation: 'update', reason: 'unsupported' },
    { kind: 'unsupported', operation: 'verify', reason: 'unsupported' },
  ],
  [
    'unsupported reason',
    { kind: 'unsupported', operation: 'update', reason: 'one' },
    { kind: 'unsupported', operation: 'update', reason: 'two' },
  ],
  [
    'unavailable command',
    { command: ['npm', 'view'], kind: 'unavailable', reason: 'missing', retryable: false },
    { command: ['npm', 'info'], kind: 'unavailable', reason: 'missing', retryable: false },
  ],
  [
    'unavailable reason',
    { command: ['npm'], kind: 'unavailable', reason: 'one', retryable: false },
    { command: ['npm'], kind: 'unavailable', reason: 'two', retryable: false },
  ],
  [
    'unavailable retryability',
    { command: ['npm'], kind: 'unavailable', reason: 'missing', retryable: false },
    { command: ['npm'], kind: 'unavailable', reason: 'missing', retryable: true },
  ],
  [
    'failed command',
    { command: ['npm', 'view'], kind: 'failed', reason: 'failed', retryable: false },
    { command: ['npm', 'info'], kind: 'failed', reason: 'failed', retryable: false },
  ],
  [
    'failed evidence',
    { evidence: [{ kind: 'provider', value: 'registry-a' }], kind: 'failed', reason: 'failed', retryable: false },
    { evidence: [{ kind: 'provider', value: 'registry-b' }], kind: 'failed', reason: 'failed', retryable: false },
  ],
  [
    'failed exit code',
    { exitCode: 1, kind: 'failed', reason: 'failed', retryable: false },
    { exitCode: 2, kind: 'failed', reason: 'failed', retryable: false },
  ],
  [
    'failed reason',
    { kind: 'failed', reason: 'one', retryable: false },
    { kind: 'failed', reason: 'two', retryable: false },
  ],
  [
    'failed remediation',
    { kind: 'failed', reason: 'failed', remediation: 'retry later', retryable: false },
    { kind: 'failed', reason: 'failed', remediation: 'fix credentials', retryable: false },
  ],
  [
    'failed retryability',
    { kind: 'failed', reason: 'failed', retryable: false },
    { kind: 'failed', reason: 'failed', retryable: true },
  ],
  ['cancelled reason', { kind: 'cancelled', reason: 'one' }, { kind: 'cancelled', reason: 'two' }],
  ['timeout', { kind: 'timed-out', timeoutMs: 10 }, { kind: 'timed-out', timeoutMs: 20 }],
  [
    'indeterminate evidence',
    { evidence: [{ kind: 'package', value: 'one' }], kind: 'indeterminate', reason: 'unknown' },
    { evidence: [{ kind: 'package', value: 'two' }], kind: 'indeterminate', reason: 'unknown' },
  ],
  ['indeterminate reason', { kind: 'indeterminate', reason: 'one' }, { kind: 'indeterminate', reason: 'two' }],
]

async function expectBatchIdentityToDiffer(
  first: ReturnType<typeof createBatchHarness>,
  second: ReturnType<typeof createBatchHarness>,
): Promise<void> {
  const firstPlan = await planRegisteredAgentUpdates(first.ports)
  const secondPlan = await planRegisteredAgentUpdates(second.ports)

  expect(firstPlan.targets).toHaveLength(1)
  expect(secondPlan.targets).toHaveLength(1)
  expect(firstPlan.targets[0]!.id).not.toBe(secondPlan.targets[0]!.id)
  expect(firstPlan.resolvedPlanId).not.toBe(secondPlan.resolvedPlanId)
}
