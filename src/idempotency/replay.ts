import type { CommandResult } from '../output/types'
import type {
  IdempotencyPostcondition,
  IdempotencyReceiptEvidence,
  InvalidIdempotencyRecordReason,
  VersionedIdempotencyRecord,
} from './schema'
import { fingerprintCanonicalValue, type CanonicalMutationRequest, type CanonicalValue } from './canonical'

export type ReplayInvalidEvidenceReason = InvalidIdempotencyRecordReason | 'invalid-json'

export type LoadedReplayEvidence =
  | { readonly kind: 'missing' }
  | { readonly kind: 'expired'; readonly record: VersionedIdempotencyRecord }
  | { readonly kind: 'invalid'; readonly reason: ReplayInvalidEvidenceReason }
  | { readonly kind: 'valid'; readonly record: VersionedIdempotencyRecord }

export type ReplayLiveValidation =
  | { readonly kind: 'satisfied' }
  | { readonly kind: 'drifted' }
  | { readonly kind: 'inconclusive' }

export interface ReplayLiveEvidence {
  readonly postcondition: IdempotencyPostcondition
  readonly receipt: IdempotencyReceiptEvidence
}

export interface ReplayFingerprints {
  readonly existingPlan: string | undefined
  readonly existingRequest: string | undefined
  readonly requestedPlan: string
  readonly requestedRequest: string
}

export interface ReplayEvaluationInput {
  readonly loaded: LoadedReplayEvidence
  readonly request: CanonicalMutationRequest
  readonly resolvedPlan: Readonly<Record<string, CanonicalValue>>
  readonly validateLive: (evidence: ReplayLiveEvidence) => Promise<ReplayLiveValidation> | ReplayLiveValidation
}

export type ReplayDecision =
  | {
      readonly fingerprints: ReplayFingerprints
      readonly invalidReason: ReplayInvalidEvidenceReason
      readonly kind: 'reject'
      readonly reason: 'invalid-evidence'
    }
  | {
      readonly fingerprints: ReplayFingerprints
      readonly kind: 'reject'
      readonly reason: 'request-mismatch'
    }
  | {
      readonly fingerprints: ReplayFingerprints
      readonly kind: 'reconcile'
      readonly reason: 'expired' | 'live-drifted' | 'live-inconclusive' | 'missing' | 'resolved-plan-changed'
    }
  | {
      readonly fingerprints: ReplayFingerprints
      readonly kind: 'replay'
      readonly result: CommandResult
    }

export async function evaluateReplay(input: ReplayEvaluationInput): Promise<ReplayDecision> {
  const requestedRequest = fingerprintCanonicalValue(input.request)
  const requestedPlan = fingerprintCanonicalValue(input.resolvedPlan)

  switch (input.loaded.kind) {
    case 'missing':
      return {
        fingerprints: withoutExisting(requestedRequest, requestedPlan),
        kind: 'reconcile',
        reason: 'missing',
      }
    case 'expired':
      return {
        fingerprints: withExisting(input.loaded.record, requestedRequest, requestedPlan),
        kind: 'reconcile',
        reason: 'expired',
      }
    case 'invalid':
      return {
        fingerprints: withoutExisting(requestedRequest, requestedPlan),
        invalidReason: input.loaded.reason,
        kind: 'reject',
        reason: 'invalid-evidence',
      }
    case 'valid':
      return evaluateValidRecord(input, input.loaded.record, requestedRequest, requestedPlan)
  }
}

async function evaluateValidRecord(
  input: ReplayEvaluationInput,
  record: VersionedIdempotencyRecord,
  requestedRequest: string,
  requestedPlan: string,
): Promise<ReplayDecision> {
  const fingerprints = withExisting(record, requestedRequest, requestedPlan)
  if (record.request.fingerprint !== requestedRequest) {
    return { fingerprints, kind: 'reject', reason: 'request-mismatch' }
  }
  if (record.resolvedPlan.fingerprint !== requestedPlan) {
    return { fingerprints, kind: 'reconcile', reason: 'resolved-plan-changed' }
  }

  const live = await input.validateLive({
    postcondition: record.postcondition.payload,
    receipt: record.receipt.payload,
  })
  switch (live.kind) {
    case 'satisfied':
      return { fingerprints, kind: 'replay', result: structuredClone(record.result) }
    case 'drifted':
      return { fingerprints, kind: 'reconcile', reason: 'live-drifted' }
    case 'inconclusive':
      return { fingerprints, kind: 'reconcile', reason: 'live-inconclusive' }
  }
}

function withExisting(
  record: VersionedIdempotencyRecord,
  requestedRequest: string,
  requestedPlan: string,
): ReplayFingerprints {
  return {
    existingPlan: record.resolvedPlan.fingerprint,
    existingRequest: record.request.fingerprint,
    requestedPlan,
    requestedRequest,
  }
}

function withoutExisting(requestedRequest: string, requestedPlan: string): ReplayFingerprints {
  return {
    existingPlan: undefined,
    existingRequest: undefined,
    requestedPlan,
    requestedRequest,
  }
}
