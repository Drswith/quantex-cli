import { describe, expect, it } from 'vitest'
import {
  canonicalizeMutationRequest,
  fingerprintCanonicalValue,
  type CanonicalValue,
} from '../../src/idempotency/canonical'
import {
  canonicalizeAllOfPostcondition,
  canonicalizeReceiptSet,
  IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  parseIdempotencyRecord,
  type FingerprintedPayload,
  type IdempotencyAllOfPostcondition,
  type IdempotencyCompositeReceiptSnapshot,
  type IdempotencyPostcondition,
  type IdempotencyReceiptEvidence,
  type IdempotencyReceiptSnapshot,
  type IdempotencySinglePostcondition,
  type InvalidIdempotencyRecordReason,
  type VersionedIdempotencyRecord,
} from '../../src/idempotency/schema'
import { createSuccessResult } from '../../src/output'

describe('versioned idempotency schema', () => {
  it('parses current evidence and retains canonical payloads for live replay validation', () => {
    const record = validRecord()

    const parsed = parseIdempotencyRecord(record)

    expect(parsed).toEqual({ kind: 'valid', record })
    if (parsed.kind !== 'valid') throw new Error('Expected a valid idempotency record.')
    expect(parsed.record.receipt.payload).toEqual({
      providerId: 'npm',
      schemaVersion: 1,
      targetId: 'codex',
      version: '1.2.3',
    })
    expect(parsed.record.postcondition.payload).toEqual({
      expectedVersion: '1.2.3',
      kind: 'version-satisfies',
      targetId: 'codex',
    })
    expect(parsed.record.receipt.fingerprint).toBe(fingerprintCanonicalValue(parsed.record.receipt.payload))
    expect(parsed.record.postcondition.fingerprint).toBe(fingerprintCanonicalValue(parsed.record.postcondition.payload))
  })

  it('parses canonical multi-provider receipt sets and all-of postconditions without a synthetic provider', () => {
    const record = validRecord()
    const npmReceipt = singleReceipt({ providerId: 'npm', targetId: '@openai/codex', version: '1.2.3' })
    const brewReceipt = singleReceipt({ providerId: 'brew', targetId: 'codex', version: '1.2.3' })
    const receiptSet = canonicalizeReceiptSet([npmReceipt, brewReceipt])
    const postcondition = canonicalizeAllOfPostcondition([
      { expectedVersion: '1.2.3', kind: 'version-satisfies', targetId: '@openai/codex' },
      { kind: 'package-present', providerId: 'brew', targetId: 'codex' },
    ])

    const parsed = parseIdempotencyRecord({
      ...record,
      postcondition: evidence(postcondition),
      receipt: evidence(receiptSet),
    })

    expect(parsed.kind).toBe('valid')
    if (parsed.kind !== 'valid') throw new Error('Expected canonical composite evidence.')
    expect(parsed.record.receipt.payload).toEqual(receiptSet)
    expect(parsed.record.postcondition.payload).toEqual(postcondition)
    expect(receiptSet).not.toHaveProperty('providerId')
    expect(receiptSet).not.toHaveProperty('targetId')
  })

  it('keeps legacy single receipts valid when extension fields resemble the composite discriminator', () => {
    const record = validRecord()
    const legacySingle: IdempotencyReceiptSnapshot = {
      items: ['legacy-provider-extension'],
      kind: 'receipt-set',
      providerId: 'npm',
      schemaVersion: 1,
      targetId: 'codex',
      version: '1.2.3',
    }
    const receipt = evidence<IdempotencyReceiptEvidence>(legacySingle)

    expect(parseIdempotencyRecord({ ...record, receipt })).toEqual({
      kind: 'valid',
      record: { ...record, receipt },
    })
  })

  it('requires exact composite wrapper keys', () => {
    const record = validRecord()
    const receiptSet = {
      ...canonicalizeReceiptSet([singleReceipt({ providerId: 'npm', targetId: 'codex' })]),
      extra: true,
    }
    const allOf = {
      ...canonicalizeAllOfPostcondition([{ executable: 'codex', kind: 'executable-present' }]),
      extra: true,
    }

    expect(parseIdempotencyRecord({ ...record, receipt: evidence(receiptSet) })).toEqual({
      kind: 'invalid',
      reason: 'invalid-payload',
    })
    expect(parseIdempotencyRecord({ ...record, postcondition: evidence(allOf) })).toEqual({
      kind: 'invalid',
      reason: 'invalid-payload',
    })
  })

  it('keeps composite wrappers closed at the TypeScript boundary', () => {
    const receiptSnapshot = singleReceipt({ providerId: 'npm', targetId: 'codex' })
    const receiptSet: IdempotencyCompositeReceiptSnapshot = {
      // @ts-expect-error Receipt-set wrappers do not expose provider extension fields.
      extra: true,
      items: [receiptSnapshot],
      kind: 'receipt-set',
      schemaVersion: 1,
    }
    const allOf: IdempotencyAllOfPostcondition = {
      // @ts-expect-error All-of wrappers do not expose postcondition extension fields.
      extra: true,
      items: [{ executable: 'codex', kind: 'executable-present' }],
      kind: 'all-of',
    }

    expect(receiptSet).toHaveProperty('extra', true)
    expect(allOf).toHaveProperty('extra', true)
  })

  it('canonicalizes reordered equivalent composite producers to identical payloads and fingerprints', () => {
    const npmReceipt = singleReceipt({ providerId: 'npm', targetId: '@openai/codex', version: '1.2.3' })
    const brewReceipt = singleReceipt({ providerId: 'brew', targetId: 'codex', version: '1.2.3' })
    const npmPostcondition: IdempotencyPostcondition = {
      kind: 'package-present',
      providerId: 'npm',
      targetId: '@openai/codex',
    }
    const brewPostcondition: IdempotencyPostcondition = {
      kind: 'package-present',
      providerId: 'brew',
      targetId: 'codex',
    }

    const firstReceipt = canonicalizeReceiptSet([npmReceipt, brewReceipt])
    const secondReceipt = canonicalizeReceiptSet([brewReceipt, npmReceipt])
    const firstPostcondition = canonicalizeAllOfPostcondition([npmPostcondition, brewPostcondition])
    const secondPostcondition = canonicalizeAllOfPostcondition([brewPostcondition, npmPostcondition])

    expect(firstReceipt).toEqual(secondReceipt)
    expect(firstPostcondition).toEqual(secondPostcondition)
    expect(fingerprintCanonicalValue(firstReceipt)).toBe(fingerprintCanonicalValue(secondReceipt))
    expect(fingerprintCanonicalValue(firstPostcondition)).toBe(fingerprintCanonicalValue(secondPostcondition))
  })

  it.each([
    {
      name: 'an empty receipt set',
      replacement: { items: [], kind: 'receipt-set', schemaVersion: 1 },
      slot: 'receipt',
    },
    {
      name: 'a nested receipt set',
      replacement: {
        items: [
          { items: [singleReceipt({ providerId: 'npm', targetId: 'codex' })], kind: 'receipt-set', schemaVersion: 1 },
        ],
        kind: 'receipt-set',
        schemaVersion: 1,
      },
      slot: 'receipt',
    },
    {
      name: 'duplicate receipt items',
      replacement: {
        items: [
          singleReceipt({ providerId: 'npm', targetId: 'codex' }),
          singleReceipt({ providerId: 'npm', targetId: 'codex' }),
        ],
        kind: 'receipt-set',
        schemaVersion: 1,
      },
      slot: 'receipt',
    },
    {
      name: 'a receipt set with an unsupported discriminator schema',
      replacement: {
        items: [singleReceipt({ providerId: 'npm', targetId: 'codex' })],
        kind: 'receipt-set',
        schemaVersion: 2,
      },
      slot: 'receipt',
    },
    {
      name: 'an empty all-of postcondition',
      replacement: { items: [], kind: 'all-of' },
      slot: 'postcondition',
    },
    {
      name: 'a nested all-of postcondition',
      replacement: {
        items: [{ items: [{ executable: 'codex', kind: 'executable-present' }], kind: 'all-of' }],
        kind: 'all-of',
      },
      slot: 'postcondition',
    },
    {
      name: 'duplicate all-of items',
      replacement: {
        items: [
          { executable: 'codex', kind: 'executable-present' },
          { executable: 'codex', kind: 'executable-present' },
        ],
        kind: 'all-of',
      },
      slot: 'postcondition',
    },
  ] as const)('rejects $name with a stable invalid composite reason', ({ replacement, slot }) => {
    const record = validRecord()

    expect(parseIdempotencyRecord({ ...record, [slot]: evidence(replacement) })).toEqual({
      kind: 'invalid',
      reason: 'invalid-payload',
    })
  })

  it('rejects unsorted receipt and all-of items even when their fingerprints are self-consistent', () => {
    const record = validRecord()
    const receiptSet = canonicalizeReceiptSet([
      singleReceipt({ providerId: 'npm', targetId: '@openai/codex' }),
      singleReceipt({ providerId: 'brew', targetId: 'codex' }),
    ])
    const allOf = canonicalizeAllOfPostcondition([
      { executable: 'codex', kind: 'executable-present' },
      { kind: 'package-present', providerId: 'npm', targetId: '@openai/codex' },
    ])

    expect(
      parseIdempotencyRecord({
        ...record,
        receipt: evidence({ ...receiptSet, items: receiptSet.items.toReversed() }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
    expect(
      parseIdempotencyRecord({
        ...record,
        postcondition: evidence({ ...allOf, items: allOf.items.toReversed() }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
  })

  it('rejects malformed composite items and composite fingerprint mismatches', () => {
    const record = validRecord()
    const receiptSet = canonicalizeReceiptSet([singleReceipt({ providerId: 'npm', targetId: 'codex' })])
    const allOf = canonicalizeAllOfPostcondition([{ executable: 'codex', kind: 'executable-present' }])

    expect(
      parseIdempotencyRecord({
        ...record,
        receipt: evidence({ ...receiptSet, items: [{ providerId: 'npm', schemaVersion: 1 }] }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
    expect(
      parseIdempotencyRecord({
        ...record,
        postcondition: evidence({ ...allOf, items: [{ kind: 'version-satisfies', targetId: 'codex' }] }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
    expect(
      parseIdempotencyRecord({
        ...record,
        receipt: { fingerprint: '0'.repeat(64), payload: receiptSet },
      }),
    ).toEqual({ kind: 'invalid', reason: 'fingerprint-mismatch' })
  })

  it('retains composite extension payloads through a parsed record round trip', () => {
    const record = validRecord()
    const receiptSet: IdempotencyCompositeReceiptSnapshot = canonicalizeReceiptSet([
      singleReceipt({
        providerEvidence: { integrity: 'sha512-npm' },
        providerId: 'npm',
        targetId: '@openai/codex',
      }),
      singleReceipt({ providerEvidence: { tap: 'openai' }, providerId: 'brew', targetId: 'codex' }),
    ])
    const postcondition = canonicalizeAllOfPostcondition([
      { agentTargetId: 'codex', kind: 'package-present', providerId: 'npm', targetId: '@openai/codex' },
      { executable: 'codex', kind: 'executable-present' },
    ])
    const compositeRecord = {
      ...record,
      postcondition: evidence(postcondition),
      receipt: evidence<IdempotencyReceiptEvidence>(receiptSet),
    }

    expect(parseIdempotencyRecord(structuredClone(compositeRecord))).toEqual({
      kind: 'valid',
      record: compositeRecord,
    })
  })

  it('keeps strict unknown-value boundaries for composite evidence without invoking accessors', () => {
    const record = validRecord()
    const receiptSet = canonicalizeReceiptSet([singleReceipt({ providerId: 'npm', targetId: 'codex' })])
    const allOf = canonicalizeAllOfPostcondition([{ executable: 'codex', kind: 'executable-present' }])
    let getterCalls = 0

    for (const [slot, wrapper] of [
      ['receipt', receiptSet],
      ['postcondition', allOf],
    ] as const) {
      const cyclic: Record<string, unknown> = { ...wrapper }
      cyclic.extension = cyclic
      const accessor = { ...wrapper }
      Object.defineProperty(accessor, 'hidden', {
        configurable: true,
        enumerable: true,
        get: () => {
          getterCalls += 1
          throw new Error('composite getter must not run')
        },
      })

      for (const payload of [
        cyclic,
        withSymbolKey({ ...wrapper }),
        withHiddenDataProperty({ ...wrapper }, 'hidden', true),
        accessor,
        { ...wrapper, items: 'not-an-array' },
      ]) {
        expectInvalidWithoutThrow(
          { ...record, [slot]: { fingerprint: fingerprintCanonicalValue(wrapper), payload } },
          'invalid-payload',
        )
      }
    }
    expect(getterCalls).toBe(0)
  })

  it('rejects invalid composite producer inputs before returning evidence', () => {
    const receiptSnapshot = singleReceipt({ providerId: 'npm', targetId: 'codex' })
    const singlePostcondition: IdempotencyPostcondition = {
      executable: 'codex',
      kind: 'executable-present',
    }

    expect(() => canonicalizeReceiptSet([])).toThrow(TypeError)
    expect(() => canonicalizeReceiptSet([receiptSnapshot, receiptSnapshot])).toThrow(TypeError)
    expect(() => canonicalizeAllOfPostcondition([])).toThrow(TypeError)
    expect(() => canonicalizeAllOfPostcondition([singlePostcondition, singlePostcondition])).toThrow(TypeError)
    expect(() =>
      canonicalizeAllOfPostcondition([
        canonicalizeAllOfPostcondition([{ executable: 'codex', kind: 'executable-present' }]),
      ]),
    ).toThrow(TypeError)
  })

  it('makes latest resolved-plan and receipt-version changes produce different evidence', () => {
    const record = validRecord()
    const differentPlan = evidence({ ...record.resolvedPlan.payload, resolvedVersion: '1.2.4' })
    const differentReceipt = evidence<IdempotencyReceiptSnapshot>({
      ...record.receipt.payload,
      version: '1.2.4',
    })

    expect(differentPlan.fingerprint).not.toBe(record.resolvedPlan.fingerprint)
    expect(differentReceipt.fingerprint).not.toBe(record.receipt.fingerprint)
  })

  it.each(['request', 'resolvedPlan', 'receipt', 'postcondition'] as const)(
    'rejects a record when its %s fingerprint is corrupt',
    field => {
      const record = validRecord()

      expect(
        parseIdempotencyRecord({
          ...record,
          [field]: { ...record[field], fingerprint: '0'.repeat(64) },
        }),
      ).toEqual({ kind: 'invalid', reason: 'fingerprint-mismatch' })
    },
  )

  it('rejects malformed record and evidence shapes', () => {
    expect(parseIdempotencyRecord(null)).toEqual({ kind: 'invalid', reason: 'malformed-record' })
    expect(parseIdempotencyRecord({ ...validRecord(), resolvedPlan: { payload: {} } })).toEqual({
      kind: 'invalid',
      reason: 'malformed-record',
    })

    const record = validRecord()
    expect(
      parseIdempotencyRecord({
        ...record,
        receipt: evidence({ ...record.receipt.payload, providerEvidence: undefined }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
  })

  it.each<{
    name: string
    reason: InvalidIdempotencyRecordReason
    value: () => unknown
  }>([
    {
      name: 'an extra envelope key',
      reason: 'malformed-record',
      value: () => ({ ...validRecord(), extra: true }),
    },
    {
      name: 'equal timestamps',
      reason: 'invalid-timestamp',
      value: () => ({ ...validRecord(), expiresAt: '2026-07-13T00:00:00.000Z' }),
    },
    {
      name: 'a parseable but noncanonical timestamp',
      reason: 'invalid-timestamp',
      value: () => ({ ...validRecord(), createdAt: '2026-07-13T00:00:00Z' }),
    },
    {
      name: 'an ok result with a non-null error',
      reason: 'malformed-record',
      value: () => {
        const record = validRecord()
        return {
          ...record,
          result: {
            ...record.result,
            error: { code: 'OPERATION_FAILED', message: 'unexpected error' },
          },
        }
      },
    },
    {
      name: 'an ok result with a nonzero exit code',
      reason: 'malformed-record',
      value: () => {
        const record = validRecord()
        return { ...record, result: { ...record.result, exitCode: 1 } }
      },
    },
    {
      name: 'malformed result metadata',
      reason: 'malformed-record',
      value: () => {
        const record = validRecord()
        return { ...record, result: { ...record.result, meta: { ...record.result.meta, mode: 'xml' } } }
      },
    },
    {
      name: 'malformed result warnings',
      reason: 'malformed-record',
      value: () => {
        const record = validRecord()
        return { ...record, result: { ...record.result, warnings: [{ code: 'INCOMPLETE' }] } }
      },
    },
    {
      name: 'malformed result data',
      reason: 'malformed-record',
      value: () => {
        const record = validRecord()
        return { ...record, result: { ...record.result, data: new Date() } }
      },
    },
  ])('rejects $name', ({ reason, value }) => {
    expectInvalidWithoutThrow(value(), reason)
  })

  it.each<{
    name: string
    reason: InvalidIdempotencyRecordReason
    value: () => unknown
  }>([
    {
      name: 'record envelope',
      reason: 'malformed-record',
      value: () => withSymbolKey(validRecord()),
    },
    {
      name: 'resolved-plan payload',
      reason: 'invalid-payload',
      value: () => {
        const record = validRecord()
        const payload = withSymbolKey({ ...record.resolvedPlan.payload })
        return { ...record, resolvedPlan: evidence(payload) }
      },
    },
    {
      name: 'receipt payload',
      reason: 'invalid-payload',
      value: () => {
        const record = validRecord()
        const payload = withSymbolKey({ ...record.receipt.payload })
        return { ...record, receipt: evidence(payload) }
      },
    },
    {
      name: 'nested result metadata',
      reason: 'malformed-record',
      value: () => {
        const record = validRecord()
        const meta = withSymbolKey({ ...record.result.meta })
        return { ...record, result: { ...record.result, meta } }
      },
    },
  ])('rejects symbol own keys in the $name without throwing', ({ reason, value }) => {
    expectInvalidWithoutThrow(value(), reason)
  })

  it('rejects cyclic payloads without throwing', () => {
    const record = validRecord()
    const payload: Record<string, unknown> = { targetId: 'codex' }
    payload.self = payload

    expectInvalidWithoutThrow(
      {
        ...record,
        resolvedPlan: { fingerprint: '0'.repeat(64), payload },
      },
      'invalid-payload',
    )
  })

  it('allows shared object references when the payload is not cyclic', () => {
    const record = validRecord()
    const shared = { providerId: 'npm', targetId: 'codex' }
    const resolvedPlan = evidence({ current: shared, requested: shared })

    expect(parseIdempotencyRecord({ ...record, resolvedPlan })).toEqual({
      kind: 'valid',
      record: { ...record, resolvedPlan },
    })
  })

  it.each<{
    name: string
    reason: InvalidIdempotencyRecordReason
    value: () => unknown
  }>([
    {
      name: 'a non-enumerable extra record property',
      reason: 'malformed-record',
      value: () => withHiddenDataProperty(validRecord(), 'hidden', true),
    },
    {
      name: 'a non-enumerable required record property',
      reason: 'malformed-record',
      value: () => withHiddenDataProperty(validRecord(), 'createdAt', '2026-07-13T00:00:00.000Z'),
    },
    {
      name: 'a non-enumerable nested payload property',
      reason: 'invalid-payload',
      value: () => {
        const record = validRecord()
        const payload = withHiddenDataProperty({ ...record.resolvedPlan.payload }, 'hidden', true)
        return { ...record, resolvedPlan: evidence(payload) }
      },
    },
  ])('rejects $name', ({ reason, value }) => {
    expectInvalidWithoutThrow(value(), reason)
  })

  it('rejects a required record accessor without invoking its getter', () => {
    const record = validRecord()
    let getterCalls = 0
    Object.defineProperty(record, 'createdAt', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1
        throw new Error('record getter must not run')
      },
    })

    expectInvalidWithoutThrow(record, 'malformed-record')
    expect(getterCalls).toBe(0)
  })

  it('rejects a nested payload accessor without invoking its getter', () => {
    const record = validRecord()
    const payload = { ...record.resolvedPlan.payload }
    let getterCalls = 0
    Object.defineProperty(payload, 'hidden', {
      configurable: true,
      get: () => {
        getterCalls += 1
        throw new Error('payload getter must not run')
      },
    })

    expectInvalidWithoutThrow(
      {
        ...record,
        resolvedPlan: { fingerprint: record.resolvedPlan.fingerprint, payload },
      },
      'invalid-payload',
    )
    expect(getterCalls).toBe(0)
  })

  it('rejects invalid or reversed timestamps', () => {
    expect(parseIdempotencyRecord({ ...validRecord(), createdAt: 'not-a-date' })).toEqual({
      kind: 'invalid',
      reason: 'invalid-timestamp',
    })
    expect(
      parseIdempotencyRecord({
        ...validRecord(),
        expiresAt: '2026-07-12T23:59:59.999Z',
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-timestamp' })
  })

  it('rejects failed public command results', () => {
    const record = validRecord()

    expect(
      parseIdempotencyRecord({
        ...record,
        result: {
          ...record.result,
          error: { code: 'OPERATION_FAILED', message: 'update failed' },
          ok: false,
        },
      }),
    ).toEqual({ kind: 'invalid', reason: 'failed-result' })
  })

  it('validates stable receipt and postcondition fields while preserving provider evidence', () => {
    const record = validRecord()
    const receipt = evidence<IdempotencyReceiptSnapshot>({
      ...record.receipt.payload,
      providerEvidence: { package: { integrity: 'sha512-future' } },
    })
    const postcondition = evidence<IdempotencyPostcondition>({
      ...record.postcondition.payload,
      providerEvidence: { channel: 'stable', revision: 7 },
    })

    const parsed = parseIdempotencyRecord({ ...record, postcondition, receipt })

    expect(parsed).toEqual({ kind: 'valid', record: { ...record, postcondition, receipt } })
    expect(
      parseIdempotencyRecord({
        ...record,
        receipt: evidence({ schemaVersion: 1, targetId: 'codex' }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
    expect(
      parseIdempotencyRecord({
        ...record,
        postcondition: evidence({ kind: 'version-satisfies', targetId: 'codex' }),
      }),
    ).toEqual({ kind: 'invalid', reason: 'invalid-payload' })
  })

  it('rejects a self-consistent but non-canonical request payload', () => {
    const record = validRecord()
    const request = evidence({
      ...record.request.payload,
      targets: ['cursor', 'codex', 'cursor'],
    })

    expect(parseIdempotencyRecord({ ...record, request })).toEqual({
      kind: 'invalid',
      reason: 'invalid-payload',
    })
  })

  it('rejects unsupported schema versions', () => {
    expect(parseIdempotencyRecord({ ...validRecord(), schemaVersion: 2 })).toEqual({
      kind: 'invalid',
      reason: 'unsupported-schema',
    })
  })

  it('rejects legacy unversioned records', () => {
    expect(
      parseIdempotencyRecord({
        action: 'install',
        createdAt: '2026-07-13T00:00:00.000Z',
        expiresAt: '2026-07-14T00:00:00.000Z',
        result: validRecord().result,
        target: { kind: 'agent', name: 'codex' },
      }),
    ).toEqual({ kind: 'invalid', reason: 'legacy-record' })
  })
})

type SingleEvidenceRecord = Omit<VersionedIdempotencyRecord, 'postcondition' | 'receipt'> & {
  readonly postcondition: FingerprintedPayload<IdempotencySinglePostcondition>
  readonly receipt: FingerprintedPayload<IdempotencyReceiptSnapshot>
}

function validRecord(): SingleEvidenceRecord {
  const request = canonicalizeMutationRequest({
    action: 'update',
    options: { requestedVersion: 'latest' },
    targets: ['codex'],
  })
  const receipt: IdempotencyReceiptSnapshot = {
    providerId: 'npm',
    schemaVersion: 1,
    targetId: 'codex',
    version: '1.2.3',
  }
  const postcondition: IdempotencyPostcondition = {
    expectedVersion: '1.2.3',
    kind: 'version-satisfies',
    targetId: 'codex',
  }

  return {
    createdAt: '2026-07-13T00:00:00.000Z',
    expiresAt: '2026-07-14T00:00:00.000Z',
    postcondition: evidence(postcondition),
    receipt: evidence(receipt),
    request: evidence(request),
    resolvedPlan: evidence({ requestedVersion: 'latest', resolvedVersion: '1.2.3', targetId: 'codex' }),
    result: createSuccessResult({
      action: 'update',
      data: { status: 'updated' },
      target: { kind: 'agent', name: 'codex' },
    }),
    schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  }
}

function evidence<T>(payload: T): FingerprintedPayload<T> {
  return { fingerprint: fingerprintCanonicalValue(payload), payload }
}

function singleReceipt(
  input: Readonly<Record<string, CanonicalValue | undefined>> & {
    readonly providerId: string
    readonly targetId: string
    readonly version?: string
  },
): IdempotencyReceiptSnapshot {
  return { ...input, schemaVersion: 1 }
}

function expectInvalidWithoutThrow(value: unknown, reason: InvalidIdempotencyRecordReason): void {
  let parsed: ReturnType<typeof parseIdempotencyRecord> | undefined
  expect(() => {
    parsed = parseIdempotencyRecord(value)
  }).not.toThrow()
  expect(parsed).toEqual({ kind: 'invalid', reason })
}

function withSymbolKey<T extends object>(value: T): T {
  Object.defineProperty(value, Symbol('hidden'), { enumerable: true, value: 'hidden' })
  return value
}

function withHiddenDataProperty<T extends object>(value: T, key: PropertyKey, propertyValue: unknown): T {
  Object.defineProperty(value, key, { configurable: true, enumerable: false, value: propertyValue })
  return value
}
