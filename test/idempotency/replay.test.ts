import { describe, expect, it, vi } from 'vitest'
import { canonicalizeMutationRequest, fingerprintCanonicalValue } from '../../src/idempotency/canonical'
import { evaluateReplay, type ReplayLiveValidation } from '../../src/idempotency/replay'
import {
  IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  type FingerprintedPayload,
  type IdempotencyPostcondition,
  type IdempotencyReceiptSnapshot,
  type VersionedIdempotencyRecord,
} from '../../src/idempotency/schema'
import { createSuccessResult } from '../../src/output'

describe('idempotency replay decisions', () => {
  it.each([
    { kind: 'missing' as const, reason: 'missing' as const },
    { kind: 'expired' as const, reason: 'expired' as const },
  ])('reconciles $kind evidence as a new invocation', async ({ kind, reason }) => {
    const record = validRecord()
    const validateLive = vi.fn((): ReplayLiveValidation => ({ kind: 'satisfied' }))

    const decision = await evaluateReplay({
      loaded: kind === 'expired' ? { kind, record } : { kind },
      request: record.request.payload,
      resolvedPlan: record.resolvedPlan.payload,
      validateLive,
    })

    expect(decision.kind).toBe('reconcile')
    if (decision.kind !== 'reconcile') throw new Error('Expected reconciliation.')
    expect(decision.reason).toBe(reason)
    expect(decision.fingerprints.requestedRequest).toBe(record.request.fingerprint)
    expect(decision.fingerprints.requestedPlan).toBe(record.resolvedPlan.fingerprint)
    expect(decision.fingerprints.existingRequest).toBe(kind === 'expired' ? record.request.fingerprint : undefined)
    expect(decision.fingerprints.existingPlan).toBe(kind === 'expired' ? record.resolvedPlan.fingerprint : undefined)
    expect(validateLive).not.toHaveBeenCalled()
  })

  it.each(['invalid-json', 'unsupported-schema', 'legacy-record', 'fingerprint-mismatch'] as const)(
    'rejects retained invalid evidence (%s) without live validation',
    async invalidReason => {
      const record = validRecord()
      const validateLive = vi.fn((): ReplayLiveValidation => ({ kind: 'satisfied' }))

      const decision = await evaluateReplay({
        loaded: { kind: 'invalid', reason: invalidReason },
        request: record.request.payload,
        resolvedPlan: record.resolvedPlan.payload,
        validateLive,
      })

      expect(decision).toEqual({
        fingerprints: {
          existingPlan: undefined,
          existingRequest: undefined,
          requestedPlan: record.resolvedPlan.fingerprint,
          requestedRequest: record.request.fingerprint,
        },
        invalidReason,
        kind: 'reject',
        reason: 'invalid-evidence',
      })
      expect(validateLive).not.toHaveBeenCalled()
    },
  )

  it('rejects a canonical request mismatch and retains both request and plan identities', async () => {
    const record = validRecord()
    const requested = canonicalizeMutationRequest({
      action: 'update',
      options: { requestedVersion: 'latest' },
      targets: ['cursor'],
    })
    const requestedPlan = { requestedVersion: 'latest', resolvedVersion: '2.0.0', targetId: 'cursor' }
    const validateLive = vi.fn((): ReplayLiveValidation => ({ kind: 'satisfied' }))

    const decision = await evaluateReplay({
      loaded: { kind: 'valid', record },
      request: requested,
      resolvedPlan: requestedPlan,
      validateLive,
    })

    expect(decision).toEqual({
      fingerprints: {
        existingPlan: record.resolvedPlan.fingerprint,
        existingRequest: record.request.fingerprint,
        requestedPlan: fingerprintCanonicalValue(requestedPlan),
        requestedRequest: fingerprintCanonicalValue(requested),
      },
      kind: 'reject',
      reason: 'request-mismatch',
    })
    expect(validateLive).not.toHaveBeenCalled()
  })

  it('treats reordered duplicate targets as the same canonical request', async () => {
    const record = validRecord({ targets: ['codex', 'cursor'] })
    const equivalent = canonicalizeMutationRequest({
      action: 'update',
      options: { requestedVersion: 'latest' },
      targets: ['cursor', 'codex', 'cursor'],
    })

    const decision = await evaluateReplay({
      loaded: { kind: 'valid', record },
      request: equivalent,
      resolvedPlan: record.resolvedPlan.payload,
      validateLive: () => ({ kind: 'satisfied' }),
    })

    expect(decision.kind).toBe('replay')
    expect(decision.fingerprints.requestedRequest).toBe(record.request.fingerprint)
  })

  it('reconciles resolved-plan changes before live validation', async () => {
    const record = validRecord()
    const requestedPlan = { ...record.resolvedPlan.payload, resolvedVersion: '1.2.4' }
    const validateLive = vi.fn((): ReplayLiveValidation => ({ kind: 'satisfied' }))

    const decision = await evaluateReplay({
      loaded: { kind: 'valid', record },
      request: record.request.payload,
      resolvedPlan: requestedPlan,
      validateLive,
    })

    expect(decision).toEqual({
      fingerprints: {
        existingPlan: record.resolvedPlan.fingerprint,
        existingRequest: record.request.fingerprint,
        requestedPlan: fingerprintCanonicalValue(requestedPlan),
        requestedRequest: record.request.fingerprint,
      },
      kind: 'reconcile',
      reason: 'resolved-plan-changed',
    })
    expect(validateLive).not.toHaveBeenCalled()
  })

  it('replays the stored success only when live evidence is satisfied', async () => {
    const record = validRecord()
    const validateLive = vi.fn(async (): Promise<ReplayLiveValidation> => ({ kind: 'satisfied' }))

    const decision = await evaluateReplay({
      loaded: { kind: 'valid', record },
      request: record.request.payload,
      resolvedPlan: record.resolvedPlan.payload,
      validateLive,
    })

    expect(validateLive).toHaveBeenCalledWith({
      postcondition: record.postcondition.payload,
      receipt: record.receipt.payload,
    })
    expect(decision).toEqual({
      fingerprints: matchingFingerprints(record),
      kind: 'replay',
      result: record.result,
    })
  })

  it('returns an independently owned deep copy of the stored result', async () => {
    const record = validRecord()
    const original = structuredClone(record.result)

    const decision = await evaluateReplay({
      loaded: { kind: 'valid', record },
      request: record.request.payload,
      resolvedPlan: record.resolvedPlan.payload,
      validateLive: () => ({ kind: 'satisfied' }),
    })

    expect(decision.kind).toBe('replay')
    if (decision.kind !== 'replay') throw new Error('Expected replay.')
    decision.result.action = 'changed'
    decision.result.meta.runId = 'fresh-run'
    decision.result.warnings[0]!.message = 'changed warning'
    ;(decision.result.warnings[0]!.details!.nested as Record<string, unknown>).source = 'changed'
    ;(decision.result.data as { nested: { value: string } }).nested.value = 'changed'

    expect(record.result).toEqual(original)
  })

  it.each([
    { live: { kind: 'drifted' as const }, reason: 'live-drifted' as const },
    { live: { kind: 'inconclusive' as const }, reason: 'live-inconclusive' as const },
  ])('reconciles $live.kind live evidence instead of replaying', async ({ live, reason }) => {
    const record = validRecord()

    const decision = await evaluateReplay({
      loaded: { kind: 'valid', record },
      request: record.request.payload,
      resolvedPlan: record.resolvedPlan.payload,
      validateLive: () => live,
    })

    expect(decision).toEqual({
      fingerprints: matchingFingerprints(record),
      kind: 'reconcile',
      reason,
    })
  })
})

function validRecord(options: { targets?: readonly string[] } = {}): VersionedIdempotencyRecord {
  const targets = options.targets ?? ['codex']
  const request = canonicalizeMutationRequest({
    action: 'update',
    options: { requestedVersion: 'latest' },
    targets,
  })
  const receipt: IdempotencyReceiptSnapshot = {
    providerId: 'npm',
    schemaVersion: 1,
    targetId: targets.join(','),
    version: '1.2.3',
  }
  const postcondition: IdempotencyPostcondition = {
    expectedVersion: '1.2.3',
    kind: 'version-satisfies',
    targetId: targets.join(','),
  }

  return {
    createdAt: '2026-07-13T00:00:00.000Z',
    expiresAt: '2026-07-14T00:00:00.000Z',
    postcondition: evidence(postcondition),
    receipt: evidence(receipt),
    request: evidence(request),
    resolvedPlan: evidence({ requestedVersion: 'latest', resolvedVersion: '1.2.3', targets: [...targets].sort() }),
    result: createSuccessResult({
      action: 'update',
      data: { nested: { value: 'stored' }, status: 'updated' },
      target: { kind: 'agent', name: targets.join(',') },
      warnings: [
        {
          code: 'RECONCILED',
          details: { nested: { source: 'npm' } },
          message: 'stored warning',
        },
      ],
    }),
    schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  }
}

function matchingFingerprints(record: VersionedIdempotencyRecord) {
  return {
    existingPlan: record.resolvedPlan.fingerprint,
    existingRequest: record.request.fingerprint,
    requestedPlan: record.resolvedPlan.fingerprint,
    requestedRequest: record.request.fingerprint,
  }
}

function evidence<T>(payload: T): FingerprintedPayload<T> {
  return { fingerprint: fingerprintCanonicalValue(payload), payload }
}
