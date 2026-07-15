import type { CommandResult } from '../output/types'
import type { CanonicalMutationRequest, CanonicalValue } from './canonical'
import { canonicalizeMutationRequest, fingerprintCanonicalValue } from './canonical'

export const IDEMPOTENCY_RECORD_SCHEMA_VERSION = 1

export interface FingerprintedPayload<T> {
  readonly fingerprint: string
  readonly payload: T
}

interface ExtensibleCanonicalPayload {
  readonly [key: string]: CanonicalValue | undefined
}

export interface IdempotencyReceiptSnapshot extends ExtensibleCanonicalPayload {
  readonly providerId: string
  readonly schemaVersion: number
  readonly targetId: string
  readonly version?: string
}

export interface IdempotencyCompositeReceiptSnapshot {
  readonly items: IdempotencyReceiptSnapshot[]
  readonly kind: 'receipt-set'
  readonly schemaVersion: typeof IDEMPOTENCY_RECORD_SCHEMA_VERSION
}

export type IdempotencyReceiptEvidence = IdempotencyReceiptSnapshot | IdempotencyCompositeReceiptSnapshot

export type IdempotencySinglePostcondition =
  | (ExtensibleCanonicalPayload & {
      readonly kind: 'package-absent' | 'package-present'
      readonly providerId: string
      readonly targetId: string
    })
  | (ExtensibleCanonicalPayload & {
      readonly executable: string
      readonly kind: 'executable-absent' | 'executable-present'
    })
  | (ExtensibleCanonicalPayload & {
      readonly expectedVersion: string
      readonly kind: 'version-satisfies'
      readonly targetId: string
    })

export interface IdempotencyAllOfPostcondition {
  readonly items: IdempotencySinglePostcondition[]
  readonly kind: 'all-of'
}

export type IdempotencyPostcondition = IdempotencySinglePostcondition | IdempotencyAllOfPostcondition

export interface VersionedIdempotencyRecord {
  readonly createdAt: string
  readonly expiresAt: string
  readonly postcondition: FingerprintedPayload<IdempotencyPostcondition>
  readonly receipt: FingerprintedPayload<IdempotencyReceiptEvidence>
  readonly request: FingerprintedPayload<CanonicalMutationRequest>
  readonly resolvedPlan: FingerprintedPayload<Readonly<Record<string, CanonicalValue>>>
  readonly result: CommandResult
  readonly schemaVersion: typeof IDEMPOTENCY_RECORD_SCHEMA_VERSION
}

export type InvalidIdempotencyRecordReason =
  | 'failed-result'
  | 'fingerprint-mismatch'
  | 'invalid-payload'
  | 'invalid-timestamp'
  | 'legacy-record'
  | 'malformed-record'
  | 'unsupported-schema'

export type ParsedIdempotencyRecord =
  | { readonly kind: 'valid'; readonly record: VersionedIdempotencyRecord }
  | { readonly kind: 'invalid'; readonly reason: InvalidIdempotencyRecordReason }

const recordKeys = [
  'createdAt',
  'expiresAt',
  'postcondition',
  'receipt',
  'request',
  'resolvedPlan',
  'result',
  'schemaVersion',
] as const
const receiptSetKeys = ['items', 'kind', 'schemaVersion'] as const
const allOfPostconditionKeys = ['items', 'kind'] as const

export function canonicalizeReceiptSet(
  items: readonly IdempotencyReceiptSnapshot[],
): IdempotencyCompositeReceiptSnapshot {
  if (items.length === 0 || !items.every(isSingleReceiptSnapshot)) {
    throw new TypeError('Receipt sets require at least one valid single-target receipt.')
  }

  return {
    items: sortUniqueEvidenceItems(items, 'Receipt sets must not contain duplicate receipts.'),
    kind: 'receipt-set',
    schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  }
}

export function canonicalizeAllOfPostcondition(
  items: readonly IdempotencyPostcondition[],
): IdempotencyAllOfPostcondition {
  if (items.length === 0 || !items.every(isSinglePostcondition)) {
    throw new TypeError('All-of postconditions require at least one valid single postcondition.')
  }

  return {
    items: sortUniqueEvidenceItems(items, 'All-of postconditions must not contain duplicate items.'),
    kind: 'all-of',
  }
}

export function parseIdempotencyRecord(value: unknown): ParsedIdempotencyRecord {
  if (!isRecord(value)) return invalid('malformed-record')
  if (!Object.hasOwn(value, 'schemaVersion')) return invalid('legacy-record')
  if (value.schemaVersion !== IDEMPOTENCY_RECORD_SCHEMA_VERSION) return invalid('unsupported-schema')
  if (!hasExactKeys(value, recordKeys)) return invalid('malformed-record')

  if (!isIsoInstant(value.createdAt) || !isIsoInstant(value.expiresAt)) return invalid('invalid-timestamp')
  if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) return invalid('invalid-timestamp')

  const resultState = validateSuccessfulCommandResult(value.result)
  if (resultState === 'failed') return invalid('failed-result')
  if (resultState === 'malformed') return invalid('malformed-record')

  if (
    !isFingerprintedPayload(value.request) ||
    !isFingerprintedPayload(value.resolvedPlan) ||
    !isFingerprintedPayload(value.receipt) ||
    !isFingerprintedPayload(value.postcondition)
  ) {
    return invalid('malformed-record')
  }

  if (
    !isCanonicalMutationRequest(value.request.payload) ||
    !isCanonicalObject(value.resolvedPlan.payload) ||
    !isReceiptEvidence(value.receipt.payload) ||
    !isPostcondition(value.postcondition.payload)
  ) {
    return invalid('invalid-payload')
  }

  for (const evidence of [value.request, value.resolvedPlan, value.receipt, value.postcondition]) {
    if (fingerprintCanonicalValue(evidence.payload) !== evidence.fingerprint) {
      return invalid('fingerprint-mismatch')
    }
  }

  return { kind: 'valid', record: value as unknown as VersionedIdempotencyRecord }
}

function invalid(reason: InvalidIdempotencyRecordReason): ParsedIdempotencyRecord {
  return { kind: 'invalid', reason }
}

function validateSuccessfulCommandResult(value: unknown): 'failed' | 'malformed' | 'valid' {
  if (!isRecord(value)) return 'malformed'
  if (!hasOnlyKeys(value, ['action', 'data', 'error', 'exitCode', 'meta', 'ok', 'target', 'warnings'])) {
    return 'malformed'
  }
  if (
    !isNonEmptyString(value.action) ||
    !Object.hasOwn(value, 'error') ||
    !Object.hasOwn(value, 'ok') ||
    !isCommandMeta(value.meta) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(isCommandDiagnostic) ||
    (Object.hasOwn(value, 'exitCode') && value.exitCode !== undefined && !Number.isInteger(value.exitCode)) ||
    (Object.hasOwn(value, 'target') && value.target !== undefined && !isCommandTarget(value.target)) ||
    (Object.hasOwn(value, 'data') && value.data !== undefined && !isCanonicalValue(value.data))
  ) {
    return 'malformed'
  }

  if (value.ok !== true || value.error !== null || (value.exitCode !== undefined && value.exitCode !== 0)) {
    return value.ok === false && isCommandDiagnostic(value.error) ? 'failed' : 'malformed'
  }

  return 'valid'
}

function isCommandMeta(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (
    !hasOnlyKeys(value, ['fetchedAt', 'mode', 'runId', 'schemaVersion', 'source', 'staleAfter', 'timestamp', 'version'])
  ) {
    return false
  }

  return (
    (value.mode === 'human' || value.mode === 'json' || value.mode === 'ndjson') &&
    isNonEmptyString(value.runId) &&
    isNonEmptyString(value.schemaVersion) &&
    isIsoInstant(value.timestamp) &&
    isNonEmptyString(value.version) &&
    (!Object.hasOwn(value, 'fetchedAt') || value.fetchedAt === undefined || isIsoInstant(value.fetchedAt)) &&
    (!Object.hasOwn(value, 'staleAfter') || value.staleAfter === undefined || isIsoInstant(value.staleAfter)) &&
    (!Object.hasOwn(value, 'source') ||
      value.source === undefined ||
      value.source === 'cache' ||
      value.source === 'network')
  )
}

function isCommandTarget(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['kind', 'name']) &&
    (value.kind === 'agent' || value.kind === 'config' || value.kind === 'self' || value.kind === 'system') &&
    (!Object.hasOwn(value, 'name') || value.name === undefined || isNonEmptyString(value.name))
  )
}

function isCommandDiagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['code', 'details', 'message']) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message) &&
    (!Object.hasOwn(value, 'details') || value.details === undefined || isCanonicalObject(value.details))
  )
}

function isFingerprintedPayload(value: unknown): value is FingerprintedPayload<unknown> {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['fingerprint', 'payload']) &&
    typeof value.fingerprint === 'string' &&
    /^[0-9a-f]{64}$/.test(value.fingerprint)
  )
}

function isCanonicalMutationRequest(value: unknown): value is CanonicalMutationRequest {
  if (
    !(
      isRecord(value) &&
      hasExactKeys(value, ['action', 'options', 'targets']) &&
      isNonEmptyString(value.action) &&
      isCanonicalObject(value.options) &&
      Array.isArray(value.targets) &&
      value.targets.every(isNonEmptyString)
    )
  ) {
    return false
  }

  const canonical = canonicalizeMutationRequest({
    action: value.action,
    options: value.options,
    targets: value.targets,
  })
  return fingerprintCanonicalValue(canonical) === fingerprintCanonicalValue(value)
}

function isReceiptEvidence(value: unknown): value is IdempotencyReceiptEvidence {
  if (!isCanonicalObject(value)) return false
  return isSingleReceiptSnapshot(value) || isIdempotencyCompositeReceiptSnapshot(value)
}

function isSingleReceiptSnapshot(value: unknown): value is IdempotencyReceiptSnapshot {
  return (
    isCanonicalObject(value) &&
    typeof value.schemaVersion === 'number' &&
    Number.isInteger(value.schemaVersion) &&
    value.schemaVersion >= 1 &&
    isNonEmptyString(value.providerId) &&
    isNonEmptyString(value.targetId) &&
    (!Object.hasOwn(value, 'version') || value.version === undefined || isNonEmptyString(value.version))
  )
}

export function isIdempotencyCompositeReceiptSnapshot(value: unknown): value is IdempotencyCompositeReceiptSnapshot {
  if (!isCanonicalObject(value)) return false
  return (
    hasExactKeys(value, receiptSetKeys) &&
    value.kind === 'receipt-set' &&
    value.schemaVersion === IDEMPOTENCY_RECORD_SCHEMA_VERSION &&
    isCanonicalEvidenceItemList(value.items, isSingleReceiptSnapshot)
  )
}

function isPostcondition(value: unknown): value is IdempotencyPostcondition {
  if (!isCanonicalObject(value) || !isNonEmptyString(value.kind)) return false

  if (value.kind === 'all-of') {
    return (
      hasExactKeys(value, allOfPostconditionKeys) && isCanonicalEvidenceItemList(value.items, isSinglePostcondition)
    )
  }

  return isSinglePostcondition(value)
}

function isSinglePostcondition(value: unknown): value is IdempotencySinglePostcondition {
  if (!isCanonicalObject(value) || !isNonEmptyString(value.kind) || value.kind === 'all-of') return false

  switch (value.kind) {
    case 'package-absent':
    case 'package-present':
      return isNonEmptyString(value.providerId) && isNonEmptyString(value.targetId)
    case 'executable-absent':
    case 'executable-present':
      return isNonEmptyString(value.executable)
    case 'version-satisfies':
      return isNonEmptyString(value.expectedVersion) && isNonEmptyString(value.targetId)
    default:
      return false
  }
}

function isCanonicalEvidenceItemList<T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isItem)) return false

  const fingerprints = value.map(fingerprintCanonicalValue)
  return fingerprints.every((fingerprint, index) => index === 0 || fingerprints[index - 1]! < fingerprint)
}

function sortUniqueEvidenceItems<T>(items: readonly T[], duplicateMessage: string): T[] {
  const keyed = items.map(item => ({ fingerprint: fingerprintCanonicalValue(item), item }))
  keyed.sort((left, right) =>
    left.fingerprint < right.fingerprint ? -1 : left.fingerprint > right.fingerprint ? 1 : 0,
  )
  if (keyed.some((entry, index) => index > 0 && keyed[index - 1]!.fingerprint === entry.fingerprint)) {
    throw new TypeError(duplicateMessage)
  }
  return keyed.map(entry => entry.item)
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
}

function isCanonicalObject(value: unknown): value is Record<string, CanonicalValue> {
  return isRecord(value) && isCanonicalValue(value)
}

function isCanonicalValue(value: unknown, ancestors = new WeakSet<object>()): value is CanonicalValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value)) return false

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value)
      if (!ownKeys.every(key => typeof key === 'string') || ownKeys.length !== value.length + 1) return false
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index))
        if (!isEnumerableDataDescriptor(descriptor) || !isCanonicalValue(descriptor.value, ancestors)) return false
      }
      return true
    }

    if (!isRecord(value)) return false
    return Reflect.ownKeys(value).every(key => {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key)
      return isEnumerableDataDescriptor(descriptor) && isCanonicalValue(descriptor.value, ancestors)
    })
  } finally {
    ancestors.delete(value)
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every(
      key => typeof key === 'string' && isEnumerableDataDescriptor(Reflect.getOwnPropertyDescriptor(value, key)),
    )
  )
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && descriptor.enumerable === true && Object.hasOwn(descriptor, 'value')
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value)
  return ownKeys.length === keys.length && hasOnlyKeys(value, keys) && keys.every(key => Object.hasOwn(value, key))
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.has(key))
}
