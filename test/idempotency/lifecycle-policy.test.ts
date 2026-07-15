import type { AgentDefinition } from '../../src/agents'
import type { ReplayLiveEvidence } from '../../src/idempotency/replay'
import type { LifecycleProviderBinding } from '../../src/lifecycle'
import type { ProviderId, ProviderObservation, ProviderOutcome, ProviderTargetKind } from '../../src/providers'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import type {
  LifecycleUpdateBatchInvocation,
  RunSingleAgentLifecycleUpdateOutcome,
  SingleAgentLifecycleUpdateInvocation,
} from '../../src/services/lifecycle-updates-production'
import { describe, expect, it, vi } from 'vitest'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import {
  createAgentAbsenceIdempotencyPolicy,
  createAgentBatchPresenceIdempotencyPolicy,
  createAgentBatchUpdateIdempotencyPolicy,
  createAgentPresenceIdempotencyPolicy,
  createAgentUpdateIdempotencyPolicy,
  normalizeAgentPresenceTargets,
} from '../../src/idempotency/lifecycle-policy'
import {
  canonicalizeAllOfPostcondition,
  canonicalizeReceiptSet,
  isIdempotencyCompositeReceiptSnapshot,
  type IdempotencyReceiptSnapshot,
} from '../../src/idempotency/schema'
import { firstPartyProviderIds, firstPartyProviderRegistry } from '../../src/providers'

const agent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  lookupAliases: ['ta'],
  name: 'test-agent',
  packages: { npm: 'test-pkg' },
  platforms: {
    linux: [{ type: 'bun' }],
    macos: [{ type: 'bun' }],
    windows: [{ type: 'bun' }],
  },
}

describe('agent lifecycle idempotency policies', () => {
  it('binds batch update replay to the deterministic prepared plan and captures every verified target', async () => {
    const fixture = batchUpdateFixture()
    const policy = await createAgentBatchUpdateIdempotencyPolicy(fixture.invocation)

    expect(policy.request).toEqual({
      action: 'update',
      options: { requestedVersion: 'latest', scope: 'all' },
      targets: ['another-agent', 'test-agent'],
    })
    expect(policy.resolvedPlan).toEqual({
      kind: 'agent-update-batch',
      planId: fixture.plan.resolvedPlanId,
      targets: ['another-agent', 'test-agent'],
    })
    const evidence = await policy.captureEvidence({ ok: true } as never)
    expect(evidence?.receipt).toMatchObject({ kind: 'receipt-set', items: expect.arrayContaining([]) })
    expect(evidence?.postcondition).toMatchObject({ kind: 'all-of', items: expect.arrayContaining([]) })
    if (
      !evidence ||
      !isIdempotencyCompositeReceiptSnapshot(evidence.receipt) ||
      evidence.postcondition.kind !== 'all-of'
    ) {
      throw new Error('Expected composite batch update evidence.')
    }
    expect(evidence.receipt.items.map(item => item.agentTargetId)).toEqual(
      expect.arrayContaining(['another-agent', 'test-agent']),
    )
    expect(evidence.postcondition.items.map(item => item.agentTargetId)).toEqual(
      expect.arrayContaining(['another-agent', 'test-agent']),
    )
  })

  it('does not capture partial batch update evidence', async () => {
    const fixture = batchUpdateFixture({ secondOutcome: 'failed' })
    const policy = await createAgentBatchUpdateIdempotencyPolicy(fixture.invocation)

    expect(await policy.captureEvidence({ ok: true } as never)).toBeUndefined()
  })

  it('validates all batch update targets with drift taking precedence over inconclusive evidence', async () => {
    const fixture = batchUpdateFixture()
    const policy = await createAgentBatchUpdateIdempotencyPolicy(fixture.invocation)
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected composite batch update evidence.')

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'satisfied' })
    fixture.observations.set('another-agent', undefined)
    fixture.observations.set('test-agent', updateObservation('1.0.0'))
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it('binds a single update replay to the exact prepared latest plan and verified outcome', async () => {
    const fixture = singleUpdateFixture({ decision: 'upgrade', outcome: 'updated', targetVersion: '1.3.0' })
    const policy = await createAgentUpdateIdempotencyPolicy('test-agent', fixture.invocation)

    expect(fixture.invocation.prepare).toHaveBeenCalledOnce()
    expect(policy.request).toEqual({
      action: 'update',
      options: { requestedVersion: 'latest', scope: 'single' },
      targets: ['test-agent'],
    })
    expect(policy.resolvedPlan).toEqual({
      kind: 'agent-update',
      planId: expect.stringContaining('version=string:1.3.0'),
      targetId: 'test-agent',
    })
    expect(await policy.captureEvidence({ ok: true } as never)).toEqual({
      postcondition: {
        agentTargetId: 'test-agent',
        expectedVersion: '1.3.0',
        kind: 'version-satisfies',
        providerId: 'bun',
        providerTargetKind: 'package',
        targetId: 'test-pkg',
      },
      receipt: {
        agentTargetId: 'test-agent',
        executableName: 'test-bin',
        executablePath: '/bin/test-bin',
        providerId: 'bun',
        providerTargetKind: 'package',
        schemaVersion: 1,
        targetId: 'test-pkg',
        version: '1.3.0',
      },
    })
  })

  it('captures a freshly verified up-to-date update but no non-verifiable success outcome', async () => {
    const upToDate = singleUpdateFixture({ decision: 'up-to-date', outcome: 'not-executed' })
    const upToDatePolicy = await createAgentUpdateIdempotencyPolicy('test-agent', upToDate.invocation)

    expect(await upToDatePolicy.captureEvidence({ ok: true } as never)).toMatchObject({
      postcondition: { expectedVersion: '1.2.3', kind: 'version-satisfies' },
      receipt: { providerId: 'bun', targetId: 'test-pkg', version: '1.2.3' },
    })
    expect(upToDate.invocation.observe).toHaveBeenCalledOnce()

    const manual = singleUpdateFixture({ decision: 'manual-required', outcome: 'not-executed' })
    const manualPolicy = await createAgentUpdateIdempotencyPolicy('test-agent', manual.invocation)
    expect(await manualPolicy.captureEvidence({ ok: true } as never)).toBeUndefined()
    expect(manual.invocation.observe).not.toHaveBeenCalled()
  })

  it('validates a single update only while its exact source and semantic version postcondition hold', async () => {
    const fixture = singleUpdateFixture({ decision: 'upgrade', outcome: 'updated', targetVersion: '1.3.0' })
    const policy = await createAgentUpdateIdempotencyPolicy('test-agent', fixture.invocation)
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected verified update evidence.')
    if (recorded.postcondition.kind !== 'version-satisfies') throw new Error('Expected version postcondition.')

    fixture.setObservation(updateObservation('1.4.0'))
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'satisfied' })

    fixture.setObservation(updateObservation('1.2.9'))
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })

    fixture.setObservation({
      ...updateObservation('1.4.0'),
      binding: { providerId: 'npm', target: { id: 'test-pkg', kind: 'package' } },
    })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it('fails closed for malformed update evidence and inconclusive live probes', async () => {
    const fixture = singleUpdateFixture({ decision: 'upgrade', outcome: 'updated', targetVersion: '1.3.0' })
    const policy = await createAgentUpdateIdempotencyPolicy('test-agent', fixture.invocation)
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected verified update evidence.')
    if (recorded.postcondition.kind !== 'version-satisfies') throw new Error('Expected version postcondition.')

    fixture.invocation.observe.mockRejectedValueOnce(new Error('probe failed'))
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'inconclusive' })

    fixture.invocation.observe.mockClear()
    for (const expectedVersion of ['', 'garbage']) {
      expect(
        await policy.validateLive({
          postcondition: { ...recorded.postcondition, expectedVersion },
          receipt: recorded.receipt,
        }),
      ).toEqual({ kind: 'inconclusive' })
    }
    expect(fixture.invocation.observe).not.toHaveBeenCalled()
  })

  it.each(compositeEvidenceMatrix())(
    'fails closed before probing when a single update policy receives $name',
    async ({ evidence }) => {
      const fixture = singleUpdateFixture({ decision: 'upgrade', outcome: 'updated', targetVersion: '1.3.0' })
      const policy = await createAgentUpdateIdempotencyPolicy('test-agent', fixture.invocation)
      fixture.invocation.observe.mockClear()

      expect(await policy.validateLive(evidence)).toEqual({ kind: 'inconclusive' })
      expect(fixture.invocation.observe).not.toHaveBeenCalled()
    },
  )

  it('normalizes batch aliases, duplicates, and target order before planning', async () => {
    const observations = new Map([
      ['another-agent', anotherPresenceObservation()],
      ['test-agent', presenceObservation()],
    ])
    const observe = vi.fn(async (targetId: string) => observations.get(targetId))
    expect(normalizeAgentPresenceTargets(['test-agent', 'aa', 'ta', 'another-agent'], resolveBatchAlias)).toEqual([
      'another-agent',
      'test-agent',
    ])

    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'aa', 'ta', 'another-agent'], {
      observe,
      resolveTarget: resolveBatchAlias,
    })

    expect(observe.mock.calls.map(([targetId]) => targetId)).toEqual(['another-agent', 'test-agent'])
    expect(policy.request).toEqual({
      action: 'install',
      options: {},
      targets: ['another-agent', 'test-agent'],
    })
    expect(policy.resolvedPlan).toEqual({
      kind: 'agent-presence-batch',
      targets: [
        {
          candidates: [{ providerId: 'npm', targetId: 'another-pkg', targetKind: 'package' }],
          targetId: 'another-agent',
        },
        {
          candidates: [{ providerId: 'bun', targetId: 'test-pkg', targetKind: 'package' }],
          targetId: 'test-agent',
        },
      ],
    })
  })

  it('captures a composite receipt and all-of postcondition from fresh batch observations', async () => {
    const observations = new Map([
      ['another-agent', anotherPresenceObservation()],
      ['test-agent', presenceObservation()],
    ])
    const observe = vi.fn(async (targetId: string) => observations.get(targetId))
    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })
    observe.mockClear()

    const evidence = await policy.captureEvidence({ ok: true } as never)

    expect(observe.mock.calls.map(([targetId]) => targetId)).toEqual(['another-agent', 'test-agent'])
    expect(evidence).toEqual({
      postcondition: canonicalizeAllOfPostcondition([
        {
          agentTargetId: 'another-agent',
          kind: 'package-present',
          providerId: 'npm',
          targetId: 'another-pkg',
        },
        {
          agentTargetId: 'test-agent',
          kind: 'package-present',
          providerId: 'bun',
          targetId: 'test-pkg',
        },
      ]),
      receipt: canonicalizeReceiptSet([
        {
          agentTargetId: 'another-agent',
          executableName: 'another-bin',
          executablePath: '/bin/another-bin',
          providerId: 'npm',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'another-pkg',
          version: '2.0.0',
        },
        {
          agentTargetId: 'test-agent',
          executableName: 'test-bin',
          executablePath: '/bin/test-bin',
          providerId: 'bun',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'test-pkg',
          version: '1.2.3',
        },
      ]),
    })
  })

  it('does not capture partial batch evidence when one fresh target is inconclusive', async () => {
    const observations = new Map<string, ResolvedAgentObservation | undefined>([
      ['another-agent', anotherPresenceObservation()],
      ['test-agent', presenceObservation()],
    ])
    const observe = vi.fn(async (targetId: string) => observations.get(targetId))
    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })
    observations.set('another-agent', undefined)
    observe.mockClear()

    expect(await policy.captureEvidence({ ok: true } as never)).toBeUndefined()
    expect(observe.mock.calls.map(([targetId]) => targetId)).toEqual(['another-agent', 'test-agent'])
  })

  it('fails closed without replacing command success when a fresh batch observation throws', async () => {
    let capture = false
    const observe = vi.fn(async (targetId: string) => {
      if (capture && targetId === 'another-agent') throw new Error('provider probe failed')
      return targetId === 'test-agent' ? presenceObservation() : anotherPresenceObservation()
    })
    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })
    capture = true

    await expect(policy.captureEvidence({ ok: true } as never)).resolves.toBeUndefined()
  })

  it('keeps batch policy preparation non-blocking when an initial observation throws', async () => {
    let failAnother = true
    const observe = vi.fn(async (targetId: string) => {
      if (failAnother && targetId === 'another-agent') throw new Error('provider probe failed')
      return targetId === 'test-agent' ? presenceObservation() : anotherPresenceObservation()
    })

    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })

    expect(policy.resolvedPlan).toEqual({
      kind: 'agent-presence-batch',
      targets: [
        { candidates: [], targetId: 'another-agent' },
        {
          candidates: [{ providerId: 'bun', targetId: 'test-pkg', targetKind: 'package' }],
          targetId: 'test-agent',
        },
      ],
    })
    await expect(policy.captureEvidence({ ok: true } as never)).resolves.toBeUndefined()

    failAnother = false
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected compatible batch evidence.')
    failAnother = true

    await expect(policy.validateLive(recorded)).resolves.toEqual({ kind: 'inconclusive' })
  })

  it('replays a batch only when every target has matching fresh presence evidence', async () => {
    const observations = new Map([
      ['another-agent', anotherPresenceObservation()],
      ['test-agent', presenceObservation()],
    ])
    const observe = vi.fn(async (targetId: string) => observations.get(targetId))
    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected compatible batch evidence.')
    observe.mockClear()

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'satisfied' })
    expect(observe.mock.calls.map(([targetId]) => targetId)).toEqual(['another-agent', 'test-agent'])
  })

  it('gives batch drift precedence over an inconclusive target', async () => {
    const observations = new Map<string, ResolvedAgentObservation | undefined>([
      ['another-agent', anotherPresenceObservation()],
      ['test-agent', presenceObservation()],
    ])
    const observe = vi.fn(async (targetId: string) => observations.get(targetId))
    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected compatible batch evidence.')

    const changed = presenceObservation()
    if (changed.observation.kind !== 'present') throw new Error('Expected present observation.')
    observations.set('test-agent', {
      ...changed,
      executable: { ...changed.executable, version: '9.0.0' },
      observation: { ...changed.observation, version: '9.0.0' },
      providerOutcome: {
        kind: 'success',
        value: { kind: 'present', target: changed.binding!.target, version: '9.0.0' },
      },
    })
    observations.set('another-agent', undefined)

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it('classifies a batch as inconclusive when no target drifted and one cannot be observed', async () => {
    const observations = new Map<string, ResolvedAgentObservation | undefined>([
      ['another-agent', anotherPresenceObservation()],
      ['test-agent', presenceObservation()],
    ])
    const observe = vi.fn(async (targetId: string) => observations.get(targetId))
    const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
      observe,
      resolveTarget: input => input,
    })
    const recorded = await policy.captureEvidence({ ok: true } as never)
    if (!recorded) throw new Error('Expected compatible batch evidence.')
    observations.set('another-agent', undefined)

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'inconclusive' })
  })

  it.each(batchInvalidEvidenceMatrix())(
    'fails closed before probing batch evidence with $name',
    async ({ evidence }) => {
      const observe = vi.fn(async (targetId: string) =>
        targetId === 'test-agent' ? presenceObservation() : anotherPresenceObservation(),
      )
      const policy = await createAgentBatchPresenceIdempotencyPolicy(['test-agent', 'another-agent'], {
        observe,
        resolveTarget: input => input,
      })
      observe.mockClear()

      expect(await policy.validateLive(evidence)).toEqual({ kind: 'inconclusive' })
      expect(observe).not.toHaveBeenCalled()
    },
  )

  it('canonicalizes an install or ensure alias before fingerprinting the request', async () => {
    const observe = vi.fn(async () => presenceObservation())

    const policy = await createAgentPresenceIdempotencyPolicy('ensure', 'ta', { observe })

    expect(observe).toHaveBeenCalledWith('ta')
    expect(policy.request).toEqual({ action: 'ensure', options: {}, targets: ['test-agent'] })
    expect(policy.resolvedPlan).toEqual({
      candidates: [{ providerId: 'bun', targetId: 'test-pkg', targetKind: 'package' }],
      kind: 'agent-presence',
      targetId: 'test-agent',
    })
  })

  it('captures fresh compatible provider and receipt evidence after a successful presence mutation', async () => {
    const before = presenceObservation()
    const after = presenceObservation()
    const observe = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after)
    const policy = await createAgentPresenceIdempotencyPolicy('install', 'ta', { observe })

    const evidence = await policy.captureEvidence({} as never)

    expect(observe).toHaveBeenCalledTimes(2)
    expect(evidence).toEqual({
      postcondition: {
        agentTargetId: 'test-agent',
        kind: 'package-present',
        providerId: 'bun',
        targetId: 'test-pkg',
      },
      receipt: {
        agentTargetId: 'test-agent',
        executableName: 'test-bin',
        executablePath: '/bin/test-bin',
        providerId: 'bun',
        providerTargetKind: 'package',
        schemaVersion: 1,
        targetId: 'test-pkg',
        version: '1.2.3',
      },
    })
  })

  it('replays presence only while compatible live provider and receipt evidence still match', async () => {
    const current = presenceObservation()
    const observe = vi.fn().mockResolvedValue(current)
    const policy = await createAgentPresenceIdempotencyPolicy('ensure', 'test-agent', { observe })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected compatible presence evidence.')

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'satisfied' })

    observe.mockResolvedValue({
      ...current,
      executable: { ...current.executable, version: '1.2.4' },
      observation: { ...current.observation, version: '1.2.4' },
    })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })

    observe.mockResolvedValue({ ...current, receipt: { ...current.receipt!, providerId: 'npm' } })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it.each(compositeEvidenceMatrix())(
    'fails closed before probing when a single-target presence policy receives $name',
    async ({ evidence }) => {
      const observe = vi.fn(async () => presenceObservation())
      const policy = await createAgentPresenceIdempotencyPolicy('ensure', 'test-agent', { observe })
      observe.mockClear()

      expect(await policy.validateLive(evidence)).toEqual({ kind: 'inconclusive' })
      expect(observe).not.toHaveBeenCalled()
    },
  )

  it('does not replay presence when live evidence is absent or inconclusive', async () => {
    const current = presenceObservation()
    const observe = vi.fn().mockResolvedValue(current)
    const policy = await createAgentPresenceIdempotencyPolicy('install', 'test-agent', { observe })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected compatible presence evidence.')

    observe.mockResolvedValue({
      ...current,
      executable: { present: false },
      observation: { drift: { kind: 'none' }, kind: 'absent', targetId: 'test-agent' },
    })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })

    observe.mockResolvedValue({
      ...current,
      observation: {
        drift: { kind: 'indeterminate', reason: 'provider failed' },
        kind: 'indeterminate',
        reason: 'provider failed',
        targetId: 'test-agent',
      },
      providerOutcome: { kind: 'failed', reason: 'provider failed', retryable: true },
    })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'inconclusive' })
  })

  it('treats conflicting live versions as drift even when the receipt did not record a version', async () => {
    const current = presenceObservation()
    const withoutReceiptVersion = { ...current, receipt: { ...current.receipt!, version: undefined } }
    const observe = vi.fn().mockResolvedValue(withoutReceiptVersion)
    const policy = await createAgentPresenceIdempotencyPolicy('ensure', 'test-agent', { observe })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected compatible presence evidence.')

    observe.mockResolvedValue({
      ...withoutReceiptVersion,
      providerOutcome: {
        kind: 'success',
        value: { kind: 'present', target: current.binding!.target, version: '1.2.4' },
      },
    })

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it('is inconclusive when a recorded version can no longer be verified live', async () => {
    const current = presenceObservation()
    const observe = vi.fn().mockResolvedValue(current)
    const policy = await createAgentPresenceIdempotencyPolicy('install', 'test-agent', { observe })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected compatible presence evidence.')

    observe.mockResolvedValue({
      ...current,
      executable: { ...current.executable, version: undefined },
      observation: { ...current.observation, version: undefined },
      providerOutcome: {
        kind: 'success',
        value: { kind: 'present', target: current.binding!.target },
      },
    })

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'inconclusive' })
  })

  it('is inconclusive when a recorded executable path is missing from live executable evidence', async () => {
    const current = presenceObservation()
    const withReceiptPath = { ...current, receipt: { ...current.receipt!, executablePath: '/bin/test-bin' } }
    const observe = vi.fn().mockResolvedValue(withReceiptPath)
    const policy = await createAgentPresenceIdempotencyPolicy('install', 'test-agent', { observe })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected compatible presence evidence.')

    observe.mockResolvedValue({
      ...withReceiptPath,
      executable: { present: true, version: '1.2.3' },
      observation: { ...withReceiptPath.observation, executablePath: undefined },
    })

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'inconclusive' })
  })

  it('uses synthesized recorded dimensions to distinguish missing live evidence from conflicts', async () => {
    const current = presenceObservation()
    const receiptWithoutDimensions = {
      ...current,
      receipt: { ...current.receipt!, version: undefined },
    }
    const observe = vi.fn().mockResolvedValue(receiptWithoutDimensions)
    const policy = await createAgentPresenceIdempotencyPolicy('ensure', 'test-agent', { observe })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected synthesized presence evidence.')
    expect(recorded.receipt).toMatchObject({ executablePath: '/bin/test-bin', version: '1.2.3' })

    observe.mockResolvedValue({
      ...receiptWithoutDimensions,
      executable: { present: true },
      observation: {
        ...receiptWithoutDimensions.observation,
        executablePath: undefined,
        version: undefined,
      },
      providerOutcome: {
        kind: 'success',
        value: { kind: 'present', target: current.binding!.target },
      },
    })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'inconclusive' })

    observe.mockResolvedValue({
      ...receiptWithoutDimensions,
      executable: { path: '/other/test-bin', present: true, version: '9.0.0' },
      observation: {
        ...receiptWithoutDimensions.observation,
        executablePath: '/other/test-bin',
        version: '9.0.0',
      },
      providerOutcome: {
        kind: 'success',
        value: {
          executablePath: '/other/test-bin',
          kind: 'present',
          target: current.binding!.target,
          version: '9.0.0',
        },
      },
    })
    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it('captures absence only from a verified pre-mutation receipt and its exact provider target', async () => {
    const before = presenceObservation()
    const observe = vi.fn().mockResolvedValueOnce(before)
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
    const isExecutablePresent = vi.fn(async () => false)

    const policy = await createAgentAbsenceIdempotencyPolicy('ta', {
      isExecutablePresent,
      observe,
      observeProviderTarget,
    })

    expect(policy.request).toEqual({ action: 'uninstall', options: {}, targets: ['test-agent'] })
    expect(policy.resolvedPlan).toEqual({ kind: 'agent-absence', targetId: 'test-agent' })
    expect(await policy.captureEvidence({} as never)).toEqual({
      postcondition: {
        agentTargetId: 'test-agent',
        kind: 'package-absent',
        providerId: 'bun',
        targetId: 'test-pkg',
      },
      receipt: {
        agentTargetId: 'test-agent',
        executableName: 'test-bin',
        providerId: 'bun',
        providerTargetKind: 'package',
        schemaVersion: 1,
        targetId: 'test-pkg',
      },
    })
    expect(observeProviderTarget).toHaveBeenCalledWith(before.binding)
    expect(isExecutablePresent).toHaveBeenCalledWith('test-bin')
  })

  it('does not invent absence evidence when the factory had no verifiable receipt source', async () => {
    const current = presenceObservation()
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi.fn(async () => ({ ...current, receipt: undefined })),
      observeProviderTarget,
    })

    expect(await policy.captureEvidence({} as never)).toBeUndefined()
    expect(observeProviderTarget).not.toHaveBeenCalled()
  })

  it('does not capture absence when executable verification is unavailable', async () => {
    const before = presenceObservation()
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => {
        throw new Error('PATH probe failed')
      }),
      observe: vi.fn().mockResolvedValueOnce(before),
      observeProviderTarget: vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding)),
    })

    expect(await policy.captureEvidence({} as never)).toBeUndefined()
  })

  it('validates recorded absence against the stored exact provider target after the lifecycle receipt is gone', async () => {
    const before = presenceObservation()
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
    const policy = await createAgentAbsenceIdempotencyPolicy('ta', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(absentObservation()),
      observeProviderTarget,
    })
    const recorded = await policy.captureEvidence({} as never)
    if (!recorded) throw new Error('Expected verified absence evidence.')
    observeProviderTarget.mockClear()

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'satisfied' })
    expect(observeProviderTarget).toHaveBeenCalledWith({
      providerId: 'bun',
      target: { binaryName: 'test-bin', id: 'test-pkg', kind: 'package' },
    })
  })

  it.each(compositeEvidenceMatrix())(
    'fails closed before probing when a single-target absence policy receives $name',
    async ({ evidence }) => {
      const observe = vi.fn(async () => presenceObservation())
      const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
      const isExecutablePresent = vi.fn(async () => false)
      const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
        isExecutablePresent,
        observe,
        observeProviderTarget,
      })
      observe.mockClear()

      expect(await policy.validateLive(evidence)).toEqual({ kind: 'inconclusive' })
      expect(observe).not.toHaveBeenCalled()
      expect(observeProviderTarget).not.toHaveBeenCalled()
      expect(isExecutablePresent).not.toHaveBeenCalled()
    },
  )

  it('treats an alternate live provider source as drift even while PATH and the stored target are absent', async () => {
    const alternate = presenceObservation()
    const alternateBinding = {
      providerId: 'npm' as const,
      target: { id: 'alternate-pkg', kind: 'package' as const },
    }
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi
        .fn()
        .mockResolvedValueOnce(absentObservation())
        .mockResolvedValueOnce({
          ...alternate,
          binding: alternateBinding,
          executable: { present: true },
          pathExecutable: { present: false },
          persistedBinding: undefined,
          providerOutcome: {
            kind: 'success',
            value: { kind: 'present', target: alternateBinding.target },
          },
          receipt: undefined,
        }),
      observeProviderTarget,
    })

    expect(await policy.validateLive(absenceEvidence())).toEqual({ kind: 'drifted' })
    expect(observeProviderTarget).not.toHaveBeenCalled()
  })

  it('treats a newly reappeared ghost receipt as drift for normal reconciliation', async () => {
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi.fn().mockResolvedValueOnce(absentObservation()).mockResolvedValueOnce(ghostObservation()),
      observeProviderTarget,
    })

    expect(await policy.validateLive(absenceEvidence())).toEqual({ kind: 'drifted' })
    expect(observeProviderTarget).not.toHaveBeenCalled()
  })

  it('treats conflicting or indeterminate current source evidence as inconclusive', async () => {
    const current = absentObservation()
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce({
          ...current,
          observation: {
            drift: { kind: 'indeterminate', reason: 'provider failed' },
            kind: 'indeterminate',
            reason: 'provider failed',
            targetId: 'test-agent',
          },
          providerOutcome: { kind: 'failed', reason: 'provider failed', retryable: true },
        }),
      observeProviderTarget,
    })

    expect(await policy.validateLive(absenceEvidence())).toEqual({ kind: 'inconclusive' })
    expect(observeProviderTarget).not.toHaveBeenCalled()
  })

  it('classifies a reinstalled exact provider target as absence drift', async () => {
    const before = presenceObservation()
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(absentObservation()),
      observeProviderTarget: vi.fn(async (binding: LifecycleProviderBinding) => presentProvider(binding)),
    })
    const recorded = absenceEvidence()

    expect(await policy.validateLive(recorded)).toEqual({ kind: 'drifted' })
  })

  it('classifies a reappeared executable as absence drift even while the exact provider target is absent', async () => {
    const before = presenceObservation()
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => true),
      observe: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(absentObservation()),
      observeProviderTarget: vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding)),
    })

    expect(await policy.validateLive(absenceEvidence())).toEqual({ kind: 'drifted' })
  })

  it.each([
    { kind: 'failed', reason: 'probe failed', retryable: true } as const,
    { kind: 'unavailable', reason: 'provider unavailable' } as const,
  ])('classifies an unavailable exact provider probe as inconclusive', async providerOutcome => {
    const before = presenceObservation()
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(absentObservation()),
      observeProviderTarget: vi.fn(async () => providerOutcome),
    })

    expect(await policy.validateLive(absenceEvidence())).toEqual({ kind: 'inconclusive' })
  })

  it('classifies a conflicting provider target response as inconclusive', async () => {
    const before = presenceObservation()
    const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
      isExecutablePresent: vi.fn(async () => false),
      observe: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(absentObservation()),
      observeProviderTarget: vi.fn(
        async (): Promise<ProviderOutcome<ProviderObservation>> => ({
          kind: 'success',
          value: { kind: 'absent', target: { id: 'other-pkg', kind: 'package' } },
        }),
      ),
    })

    expect(await policy.validateLive(absenceEvidence())).toEqual({ kind: 'inconclusive' })
  })

  it.each(providerTargetKindMatrix())(
    'fails closed for the $providerId/$targetKind stored provider-target combination',
    async ({ providerId, targetKind, valid }) => {
      const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => absentProvider(binding))
      const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
        isExecutablePresent: vi.fn(async () => false),
        observe: vi.fn().mockResolvedValueOnce(absentObservation()).mockResolvedValueOnce(absentObservation()),
        observeProviderTarget,
      })

      expect(await policy.validateLive(absenceEvidence({ providerId, targetKind }))).toEqual({
        kind: valid ? 'satisfied' : 'inconclusive',
      })
      expect(observeProviderTarget).toHaveBeenCalledTimes(valid ? 1 : 0)
    },
  )

  it('aborts the production exact-target probe through CLI cancellation and captures no evidence', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'absence-cancel' })
    const adapter = firstPartyProviderRegistry.get('bun')
    if (!adapter) throw new Error('Expected bun provider adapter.')
    let probeSignal: AbortSignal | undefined
    const observeSpy = vi.spyOn(adapter, 'observe').mockImplementation(
      request =>
        new Promise(resolve => {
          probeSignal = request.context.signal
          request.context.signal.addEventListener(
            'abort',
            () => resolve({ kind: 'cancelled', reason: String(request.context.signal.reason) }),
            { once: true },
          )
        }),
    )

    try {
      const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
        isExecutablePresent: vi.fn(async () => false),
        observe: vi.fn(async () => presenceObservation()),
      })
      const capture = policy.captureEvidence({} as never)
      await vi.waitFor(() => expect(observeSpy).toHaveBeenCalledOnce())

      await cancelCliContextOperations()
      const result = await Promise.race([
        capture,
        new Promise<'hung'>(resolve => {
          setTimeout(() => resolve('hung'), 50)
        }),
      ])

      expect(result).toBeUndefined()
      expect(probeSignal?.aborted).toBe(true)
    } finally {
      observeSpy.mockRestore()
    }
  })

  it('propagates the CLI timeout to the production exact-target probe and captures no timed-out evidence', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'absence-timeout', timeoutMs: 7 })
    const adapter = firstPartyProviderRegistry.get('bun')
    if (!adapter) throw new Error('Expected bun provider adapter.')
    const observeSpy = vi.spyOn(adapter, 'observe').mockImplementation(async request => {
      expect(request.context.timeoutMs).toBe(7)
      return { kind: 'timed-out', timeoutMs: 7 }
    })

    try {
      const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
        isExecutablePresent: vi.fn(async () => false),
        observe: vi.fn(async () => presenceObservation()),
      })

      expect(await policy.captureEvidence({} as never)).toBeUndefined()
      expect(observeSpy).toHaveBeenCalledOnce()
    } finally {
      observeSpy.mockRestore()
    }
  })

  it('disposes the production exact-target cancellation listener after a completed probe', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'absence-dispose' })
    const adapter = firstPartyProviderRegistry.get('bun')
    if (!adapter) throw new Error('Expected bun provider adapter.')
    let probeSignal: AbortSignal | undefined
    const observeSpy = vi.spyOn(adapter, 'observe').mockImplementation(async request => {
      probeSignal = request.context.signal
      return { kind: 'success', value: { kind: 'absent', target: request.target } }
    })

    try {
      const policy = await createAgentAbsenceIdempotencyPolicy('test-agent', {
        isExecutablePresent: vi.fn(async () => false),
        observe: vi.fn(async () => presenceObservation()),
      })

      expect(await policy.captureEvidence({} as never)).toBeDefined()
      await cancelCliContextOperations()
      expect(probeSignal?.aborted).toBe(false)
    } finally {
      observeSpy.mockRestore()
    }
  })
})

function absenceEvidence(options: { providerId?: ProviderId; targetKind?: ProviderTargetKind } = {}) {
  const providerId = options.providerId ?? 'bun'
  const targetKind = options.targetKind ?? 'package'
  const targetId = providerId === 'bun' ? 'test-pkg' : `${providerId}-target`
  return {
    postcondition: {
      agentTargetId: 'test-agent',
      kind: 'package-absent' as const,
      providerId,
      targetId,
    },
    receipt: {
      agentTargetId: 'test-agent',
      executableName: 'test-bin',
      providerId,
      providerTargetKind: targetKind,
      schemaVersion: 1,
      targetId,
    },
  }
}

function compositeEvidenceMatrix(): Array<{ evidence: ReplayLiveEvidence; name: string }> {
  const firstReceipt: IdempotencyReceiptSnapshot = {
    providerId: 'bun',
    schemaVersion: 1,
    targetId: 'test-pkg',
  }
  const secondReceipt: IdempotencyReceiptSnapshot = {
    providerId: 'npm',
    schemaVersion: 1,
    targetId: 'other-pkg',
  }
  const singlePostcondition = { kind: 'package-present' as const, providerId: 'bun', targetId: 'test-pkg' }
  const allOfPostcondition = canonicalizeAllOfPostcondition([
    singlePostcondition,
    { kind: 'package-present', providerId: 'npm', targetId: 'other-pkg' },
  ])
  const receiptSet = canonicalizeReceiptSet([firstReceipt, secondReceipt])

  return [
    {
      evidence: { postcondition: singlePostcondition, receipt: receiptSet },
      name: 'a receipt-set with a single postcondition',
    },
    {
      evidence: { postcondition: allOfPostcondition, receipt: firstReceipt },
      name: 'an all-of postcondition with a single receipt',
    },
    {
      evidence: { postcondition: allOfPostcondition, receipt: receiptSet },
      name: 'a receipt-set with an all-of postcondition',
    },
  ]
}

function batchInvalidEvidenceMatrix(): Array<{ evidence: ReplayLiveEvidence; name: string }> {
  const testPostcondition = {
    agentTargetId: 'test-agent',
    kind: 'package-present' as const,
    providerId: 'bun',
    targetId: 'test-pkg',
  }
  const anotherPostcondition = {
    agentTargetId: 'another-agent',
    kind: 'package-present' as const,
    providerId: 'npm',
    targetId: 'another-pkg',
  }
  const testReceipt: IdempotencyReceiptSnapshot = {
    agentTargetId: 'test-agent',
    providerId: 'bun',
    schemaVersion: 1,
    targetId: 'test-pkg',
  }
  const anotherReceipt: IdempotencyReceiptSnapshot = {
    agentTargetId: 'another-agent',
    providerId: 'npm',
    schemaVersion: 1,
    targetId: 'another-pkg',
  }

  return [
    {
      evidence: { postcondition: testPostcondition, receipt: testReceipt },
      name: 'non-composite halves',
    },
    {
      evidence: {
        postcondition: canonicalizeAllOfPostcondition([testPostcondition, anotherPostcondition]),
        receipt: canonicalizeReceiptSet([testReceipt, { ...anotherReceipt, agentTargetId: 'test-agent' }]),
      },
      name: 'duplicate receipt target identities',
    },
    {
      evidence: {
        postcondition: canonicalizeAllOfPostcondition([testPostcondition, anotherPostcondition]),
        receipt: canonicalizeReceiptSet([testReceipt, { ...anotherReceipt, agentTargetId: 'unexpected-agent' }]),
      },
      name: 'cross-target receipt identities',
    },
    {
      evidence: {
        postcondition: canonicalizeAllOfPostcondition([testPostcondition, anotherPostcondition]),
        receipt: canonicalizeReceiptSet([{ ...testReceipt, providerId: 'npm', targetId: 'wrong-pkg' }, anotherReceipt]),
      },
      name: 'cross-half provider identities',
    },
  ]
}

function providerTargetKindMatrix(): Array<{
  providerId: ProviderId
  targetKind: ProviderTargetKind
  valid: boolean
}> {
  const targetKinds = ['binary', 'cask', 'formula', 'id', 'package', 'script', 'tool'] as const
  return firstPartyProviderIds.flatMap(providerId =>
    targetKinds.map(targetKind => ({
      providerId,
      targetKind,
      valid: expectedProviderTargetKinds(providerId).includes(targetKind),
    })),
  )
}

function expectedProviderTargetKinds(providerId: ProviderId): readonly ProviderTargetKind[] {
  switch (providerId) {
    case 'binary':
      return ['binary']
    case 'script':
      return ['script']
    case 'brew':
      return ['formula', 'cask']
    case 'winget':
      return ['id']
    case 'deno':
    case 'mise':
    case 'uv':
      return ['tool']
    case 'bun':
    case 'cargo':
    case 'npm':
    case 'pip':
      return ['package']
  }
}

function absentProvider(binding: LifecycleProviderBinding): ProviderOutcome<ProviderObservation> {
  return { kind: 'success', value: { kind: 'absent', target: binding.target } }
}

function presentProvider(binding: LifecycleProviderBinding): ProviderOutcome<ProviderObservation> {
  return { kind: 'success', value: { kind: 'present', target: binding.target } }
}

function absentObservation(): ResolvedAgentObservation {
  const current = presenceObservation()
  return {
    ...current,
    binding: undefined,
    capabilities: [],
    executable: { present: false },
    installedState: undefined,
    observation: { drift: { kind: 'none' }, kind: 'absent', targetId: current.agent.name },
    pathExecutable: { present: false },
    persistedBinding: undefined,
    providerOutcome: undefined,
    receipt: undefined,
  }
}

function ghostObservation(): ResolvedAgentObservation {
  const current = presenceObservation()
  return {
    ...current,
    executable: { present: false },
    installedState: undefined,
    observation: { drift: { kind: 'recorded-absent' }, kind: 'absent', targetId: current.agent.name },
    pathExecutable: { present: false },
    providerOutcome: { kind: 'success', value: { kind: 'absent', target: current.binding!.target } },
  }
}

function presenceObservation(): ResolvedAgentObservation {
  const binding = {
    providerId: 'bun' as const,
    target: { id: 'test-pkg', kind: 'package' as const },
  }
  const receipt = {
    kind: 'lifecycle-receipt' as const,
    providerId: 'bun',
    providerTargetId: 'test-pkg',
    providerTargetKind: 'package' as const,
    schemaVersion: 1,
    targetId: agent.name,
    verifiedAt: '2026-07-13T00:00:00.000Z',
    version: '1.2.3',
  }

  return {
    agent,
    binding,
    capabilities: ['install', 'observe'],
    catalogMethods: [binding],
    executable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    installedState: { agentName: agent.name, installType: 'bun', packageName: 'test-pkg' },
    latestVersion: '1.2.3',
    methods: [{ type: 'bun' }],
    observation: {
      drift: { kind: 'none' },
      executablePath: '/bin/test-bin',
      kind: 'present',
      providerId: 'bun',
      providerTargetId: 'test-pkg',
      providerTargetKind: 'package',
      targetId: agent.name,
      version: '1.2.3',
    },
    pathExecutable: { path: '/bin/test-bin', present: true, version: '1.2.3' },
    persistedBinding: binding,
    providerOutcome: {
      kind: 'success',
      value: { kind: 'present', target: binding.target, version: '1.2.3' },
    },
    receipt,
    resolvedBinaryPath: '/bin/test-bin',
  }
}

function updateObservation(version: string): ResolvedAgentObservation {
  const current = presenceObservation()
  if (current.observation.kind !== 'present') throw new Error('Expected present observation.')
  return {
    ...current,
    executable: { ...current.executable, version },
    observation: { ...current.observation, version },
    providerOutcome: {
      kind: 'success',
      value: { kind: 'present', target: current.binding!.target, version },
    },
    receipt: { ...current.receipt!, version },
  }
}

function singleUpdateFixture(options: {
  decision: 'manual-required' | 'up-to-date' | 'upgrade'
  outcome: 'not-executed' | 'updated'
  targetVersion?: string
}) {
  const targetVersion = options.targetVersion ?? '1.2.3'
  const before = updateObservation('1.2.3')
  const planned = {
    before,
    binding: before.binding!,
    plannedTargetVersion: targetVersion,
    planning: {
      decision: options.decision,
      plan: {
        id: `update-${before.agent.name}`,
        intent: { kind: 'update', targetId: before.agent.name, targetVersion },
        kind: 'lifecycle-plan',
        observation: before.observation,
        steps: [],
      },
    },
  } as never
  const planning = { kind: 'planned' as const, planned }
  const after = updateObservation(targetVersion)
  const outcome =
    options.outcome === 'updated'
      ? ({
          after,
          kind: 'updated',
          plan: planned,
          providerOutcome: { kind: 'success', value: { evidence: [], target: before.binding!.target } },
          receipt: after.receipt!,
          verification: {
            kind: 'satisfied',
            observation: after.observation,
            postcondition: { expectedVersion: targetVersion, kind: 'version-satisfies', targetId: 'test-pkg' },
          },
        } as RunSingleAgentLifecycleUpdateOutcome)
      : ({ kind: 'not-executed', plan: planned } as RunSingleAgentLifecycleUpdateOutcome)
  let observation = after
  const invocation = {
    dispose: vi.fn(),
    getOutcome: vi.fn(() => outcome),
    observe: vi.fn(async () => observation),
    prepare: vi.fn(async () => planning),
    run: vi.fn(async () => outcome),
  } satisfies SingleAgentLifecycleUpdateInvocation

  return {
    invocation,
    setObservation(value: ResolvedAgentObservation) {
      observation = value
    },
  }
}

function batchUpdateFixture(options: { secondOutcome?: 'failed' | 'updated' } = {}) {
  const definitions = [
    { before: anotherPresenceObservation(), targetVersion: '2.1.0' },
    { before: presenceObservation(), targetVersion: '1.3.0' },
  ]
  const targets = definitions.map(({ before, targetVersion }) => {
    const planned = {
      before,
      binding: before.binding!,
      plannedTargetVersion: targetVersion,
      planning: {
        decision: 'upgrade',
        plan: {
          id: `update-${before.agent.name}`,
          intent: { kind: 'update', targetId: before.agent.name, targetVersion },
          kind: 'lifecycle-plan',
          observation: before.observation,
          steps: [],
        },
      },
    }
    return {
      agentName: before.agent.name,
      id: `update-target:${before.agent.name}:${targetVersion}`,
      outcome: { kind: 'planned', planned },
    }
  })
  const plan = {
    id: 'update-batch:another-agent,test-agent',
    kind: 'lifecycle-update-batch-plan' as const,
    providerBuckets: [],
    resolvedPlanId: `update-batch:${targets.map(target => target.id).join(',')}`,
    targets,
  }
  const observations = new Map<string, ResolvedAgentObservation | undefined>([
    ['another-agent', updateAnotherObservation('2.1.0')],
    ['test-agent', updateObservation('1.3.0')],
  ])
  const results = targets.map((target, index) => {
    const planned = target.outcome.planned
    if (index === 1 && options.secondOutcome === 'failed') {
      return {
        agentName: target.agentName,
        execution: {
          kind: 'provider-failed',
          plan: planned,
          providerOutcome: { kind: 'failed', reason: 'update failed', retryable: false },
        },
        id: target.id,
        planning: target.outcome,
      }
    }
    const after = observations.get(target.agentName)!
    return {
      agentName: target.agentName,
      execution: {
        after,
        kind: 'updated',
        plan: planned,
        providerOutcome: { kind: 'success', value: { evidence: [], target: planned.binding.target } },
        receipt: after.receipt!,
        verification: {
          kind: 'satisfied',
          observation: after.observation,
          postcondition: {
            expectedVersion: planned.plannedTargetVersion,
            kind: 'version-satisfies',
            targetId: planned.binding.target.id,
          },
        },
      },
      id: target.id,
      planning: target.outcome,
    }
  })
  const outcome = {
    cancellationRemainder: [],
    kind: 'lifecycle-update-batch-outcome',
    plan,
    results,
    success: options.secondOutcome !== 'failed',
  } as never
  const invocation = {
    dispose: vi.fn(),
    getOutcome: vi.fn(() => outcome),
    observe: vi.fn(async (agentName: string) => observations.get(agentName)),
    prepare: vi.fn(async () => plan as never),
    run: vi.fn(async () => outcome),
  } satisfies LifecycleUpdateBatchInvocation
  return { invocation, observations, outcome, plan }
}

function updateAnotherObservation(version: string): ResolvedAgentObservation {
  const current = anotherPresenceObservation()
  if (current.observation.kind !== 'present') throw new Error('Expected present observation.')
  return {
    ...current,
    executable: { ...current.executable, version },
    observation: { ...current.observation, version },
    providerOutcome: {
      kind: 'success',
      value: { kind: 'present', target: current.binding!.target, version },
    },
    receipt: { ...current.receipt!, version },
  }
}

function anotherPresenceObservation(): ResolvedAgentObservation {
  const current = presenceObservation()
  const anotherAgent: AgentDefinition = {
    ...agent,
    binaryName: 'another-bin',
    displayName: 'Another Agent',
    lookupAliases: ['aa'],
    name: 'another-agent',
    packages: { npm: 'another-pkg' },
  }
  const binding = {
    providerId: 'npm' as const,
    target: { id: 'another-pkg', kind: 'package' as const },
  }

  return {
    ...current,
    agent: anotherAgent,
    binding,
    catalogMethods: [binding],
    executable: { path: '/bin/another-bin', present: true, version: '2.0.0' },
    installedState: { agentName: anotherAgent.name, installType: 'npm', packageName: 'another-pkg' },
    latestVersion: '2.0.0',
    methods: [{ type: 'npm' }],
    observation: {
      drift: { kind: 'none' },
      executablePath: '/bin/another-bin',
      kind: 'present',
      providerId: 'npm',
      providerTargetId: 'another-pkg',
      providerTargetKind: 'package',
      targetId: anotherAgent.name,
      version: '2.0.0',
    },
    pathExecutable: { path: '/bin/another-bin', present: true, version: '2.0.0' },
    persistedBinding: binding,
    providerOutcome: {
      kind: 'success',
      value: { kind: 'present', target: binding.target, version: '2.0.0' },
    },
    receipt: {
      kind: 'lifecycle-receipt',
      providerId: 'npm',
      providerTargetId: 'another-pkg',
      providerTargetKind: 'package',
      schemaVersion: 1,
      targetId: anotherAgent.name,
      verifiedAt: '2026-07-13T00:00:00.000Z',
      version: '2.0.0',
    },
    resolvedBinaryPath: '/bin/another-bin',
  }
}

function resolveBatchAlias(input: string): string {
  return input === 'ta' ? 'test-agent' : input === 'aa' ? 'another-agent' : input
}
