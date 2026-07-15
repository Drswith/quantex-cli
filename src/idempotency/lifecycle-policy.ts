import type { CommandIdempotencyPolicy } from '../command-runtime'
import type { LifecycleProviderBinding } from '../lifecycle'
import type { LifecycleReceipt } from '../lifecycle'
import type { ProviderId, ProviderObservation, ProviderOutcome, ProviderTargetKind } from '../providers'
import type { LifecycleUpdateObservedAgent, SingleAgentLifecycleUpdatePlan } from '../services/lifecycle-updates'
import type {
  LifecycleUpdateBatchInvocation,
  SingleAgentLifecycleUpdateInvocation,
} from '../services/lifecycle-updates-production'
import type {
  IdempotencyAllOfPostcondition,
  IdempotencyPostcondition,
  IdempotencyReceiptEvidence,
  IdempotencyReceiptSnapshot,
  IdempotencySinglePostcondition,
} from './schema'
import { observeLifecycleProvider, providerBindingsEqual, resolveReceiptProviderBinding } from '../lifecycle'
import { firstPartyProviderIds } from '../providers'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { resolveAgent } from '../services/agents'
import { resolveAgentObservation, type ResolvedAgentObservation } from '../services/lifecycle-observations'
import { getSingleAgentLifecycleUpdateResolvedPlanId } from '../services/lifecycle-updates'
import { isBinaryInPath } from '../utils/detect'
import { compareVersions } from '../utils/version'
import { canonicalizeMutationRequest, fingerprintCanonicalValue } from './canonical'
import { canonicalizeAllOfPostcondition, canonicalizeReceiptSet, isIdempotencyCompositeReceiptSnapshot } from './schema'

interface AgentLifecyclePolicyPorts {
  readonly isExecutablePresent?: (binaryName: string) => Promise<boolean>
  readonly observe?: (agentName: string) => Promise<ResolvedAgentObservation | undefined>
  readonly observeProviderTarget?: (binding: LifecycleProviderBinding) => Promise<ProviderOutcome<ProviderObservation>>
  readonly resolveTarget?: (agentName: string) => string | undefined
}

interface PresenceReplayEvidence {
  readonly postcondition: IdempotencySinglePostcondition
  readonly receipt: IdempotencyReceiptSnapshot
}

type PresenceCandidateIdentity = Readonly<Record<string, string>> & {
  readonly binaryName?: string
  readonly providerId: ProviderId
  readonly targetId: string
  readonly targetKind: ProviderTargetKind
}

interface StoredBatchPresenceTarget {
  readonly postcondition: IdempotencySinglePostcondition
  readonly receipt: IdempotencyReceiptSnapshot
}

type PresenceEvidenceClassification =
  | { readonly evidence: PresenceReplayEvidence; readonly kind: 'compatible' }
  | { readonly kind: 'drifted' | 'inconclusive' }

interface VerifiedAbsenceSource {
  readonly agentTargetId: string
  readonly binding: LifecycleProviderBinding
  readonly executableName: string
  readonly receiptSchemaVersion: number
}

interface StoredUpdateEvidence {
  readonly agentTargetId: string
  readonly expectedVersion: string
  readonly providerId: ProviderId
  readonly providerTargetKind: ProviderTargetKind
  readonly providerTargetId: string
}

type UpdateObservationClassification =
  | { readonly evidence: PresenceReplayEvidence; readonly kind: 'compatible' }
  | { readonly kind: 'drifted' | 'inconclusive' }

export function normalizeAgentPresenceTargets(
  agentNames: readonly string[],
  resolveTarget: (agentName: string) => string | undefined = agentName => resolveAgent(agentName)?.name,
): string[] {
  return [
    ...canonicalizeMutationRequest({
      action: 'install',
      targets: agentNames.map(agentName => resolveTarget(agentName) ?? agentName),
    }).targets,
  ]
}

export async function createAgentUpdateIdempotencyPolicy(
  agentName: string,
  invocation: Pick<SingleAgentLifecycleUpdateInvocation, 'getOutcome' | 'observe' | 'prepare'>,
): Promise<CommandIdempotencyPolicy<unknown>> {
  const planning = await invocation.prepare()
  const targetId =
    planning.kind === 'planned' ? planning.planned.before.agent.name : (resolveAgent(agentName)?.name ?? agentName)

  return {
    async captureEvidence() {
      const outcome = invocation.getOutcome()
      if (!outcome) return undefined
      if (outcome.kind === 'updated') {
        const classified = classifyUpdateObservation(outcome.after, outcome.plan, outcome.receipt)
        return classified.kind === 'compatible' ? classified.evidence : undefined
      }
      if (outcome.kind !== 'not-executed' || outcome.plan.planning.decision !== 'up-to-date') return undefined

      const current = await safelyObserveUpdate(invocation.observe, targetId)
      if (current.kind === 'failed' || !current.observation) return undefined
      const classified = classifyUpdateObservation(current.observation, outcome.plan)
      return classified.kind === 'compatible' ? classified.evidence : undefined
    },
    request: canonicalizeMutationRequest({
      action: 'update',
      options: { requestedVersion: 'latest', scope: 'single' },
      targets: [targetId],
    }),
    resolvedPlan: {
      kind: 'agent-update',
      planId: getSingleAgentLifecycleUpdateResolvedPlanId(targetId, planning),
      targetId,
    },
    async validateLive(recorded) {
      const stored = resolveStoredUpdateEvidence(recorded, targetId)
      if (!stored) return { kind: 'inconclusive' }
      const current = await safelyObserveUpdate(invocation.observe, targetId)
      if (current.kind === 'failed' || !current.observation) return { kind: 'inconclusive' }
      const classified = classifyStoredUpdateObservation(current.observation, stored)
      return { kind: classified }
    },
  }
}

export async function createAgentBatchUpdateIdempotencyPolicy(
  invocation: Pick<LifecycleUpdateBatchInvocation, 'getOutcome' | 'observe' | 'prepare'>,
): Promise<CommandIdempotencyPolicy<unknown>> {
  const plan = await invocation.prepare()
  const targetIds = plan.targets.map(target => target.agentName)

  return {
    async captureEvidence() {
      const outcome = invocation.getOutcome()
      if (!outcome || outcome.plan !== plan) return undefined
      const results = new Map(outcome.results.map(result => [result.id, result]))
      const evidence: PresenceReplayEvidence[] = []

      for (const target of plan.targets) {
        if (target.outcome.kind !== 'planned') return undefined
        const execution = results.get(target.id)?.execution
        let classified: UpdateObservationClassification
        if (execution?.kind === 'updated') {
          classified = classifyUpdateObservation(execution.after, execution.plan, execution.receipt)
        } else if (execution?.kind === 'not-executed' && execution.plan.planning.decision === 'up-to-date') {
          const current = await safelyObserveUpdate(invocation.observe, target.agentName)
          if (current.kind === 'failed' || !current.observation) return undefined
          classified = classifyUpdateObservation(current.observation, execution.plan)
        } else {
          return undefined
        }
        if (classified.kind !== 'compatible') return undefined
        evidence.push(classified.evidence)
      }

      return {
        postcondition: canonicalizeAllOfPostcondition(evidence.map(item => item.postcondition)),
        receipt: canonicalizeReceiptSet(evidence.map(item => item.receipt)),
      }
    },
    request: canonicalizeMutationRequest({
      action: 'update',
      options: { requestedVersion: 'latest', scope: 'all' },
      targets: targetIds,
    }),
    resolvedPlan: { kind: 'agent-update-batch', planId: plan.resolvedPlanId, targets: targetIds },
    async validateLive(recorded) {
      const stored = resolveStoredBatchUpdateEvidence(recorded, targetIds)
      if (!stored) return { kind: 'inconclusive' }
      const classifications = await Promise.all(
        targetIds.map(async targetId => {
          const current = await safelyObserveUpdate(invocation.observe, targetId)
          if (current.kind === 'failed' || !current.observation) return 'inconclusive' as const
          return classifyStoredUpdateObservation(current.observation, stored.get(targetId)!)
        }),
      )
      if (classifications.includes('drifted')) return { kind: 'drifted' }
      return classifications.includes('inconclusive') ? { kind: 'inconclusive' } : { kind: 'satisfied' }
    },
  }
}

export async function createAgentBatchPresenceIdempotencyPolicy(
  agentNames: readonly string[],
  ports: AgentLifecyclePolicyPorts = {},
): Promise<CommandIdempotencyPolicy<unknown>> {
  const observe = ports.observe ?? resolveAgentObservation
  const targetIds = normalizeAgentPresenceTargets(agentNames, ports.resolveTarget)
  const initialObservations = await Promise.all(targetIds.map(targetId => safelyObserveAgent(observe, targetId)))

  return {
    async captureEvidence() {
      const classified = await Promise.all(
        targetIds.map(async targetId => {
          const current = await safelyObserveAgent(observe, targetId)
          return current.kind === 'success' && current.observation
            ? classifyPresenceEvidence(current.observation)
            : ({ kind: 'inconclusive' } as const)
        }),
      )
      if (classified.some(item => item.kind !== 'compatible')) return undefined

      const evidence = classified.flatMap(item => (item.kind === 'compatible' ? [item.evidence] : []))
      return {
        postcondition: canonicalizeAllOfPostcondition(evidence.map(item => item.postcondition)),
        receipt: canonicalizeReceiptSet(evidence.map(item => item.receipt)),
      }
    },
    request: canonicalizeMutationRequest({ action: 'install', targets: targetIds }),
    resolvedPlan: {
      kind: 'agent-presence-batch',
      targets: initialObservations.map((initial, index) => {
        const observation = initial.kind === 'success' ? initial.observation : undefined
        return {
          candidates: sortCandidateIdentities(
            observation?.catalogMethods.map(
              candidate =>
                ({
                  ...(candidate.target.binaryName ? { binaryName: candidate.target.binaryName } : {}),
                  providerId: candidate.providerId,
                  targetId: candidate.target.id,
                  targetKind: candidate.target.kind,
                }) as PresenceCandidateIdentity,
            ) ?? [],
          ),
          targetId: targetIds[index]!,
        }
      }),
    },
    async validateLive(recorded) {
      const stored = resolveStoredBatchPresence(recorded, targetIds)
      if (!stored) return { kind: 'inconclusive' }

      const classifications = await Promise.all(
        targetIds.map(async targetId => {
          const current = await safelyObserveAgent(observe, targetId)
          if (current.kind === 'failed' || !current.observation) return 'inconclusive' as const

          const expected = stored.get(targetId)!
          const classified = classifyPresenceEvidence(current.observation, expected.receipt)
          if (classified.kind !== 'compatible') return classified.kind

          return fingerprintCanonicalValue(classified.evidence.postcondition) ===
            fingerprintCanonicalValue(expected.postcondition) &&
            fingerprintCanonicalValue(classified.evidence.receipt) === fingerprintCanonicalValue(expected.receipt)
            ? ('satisfied' as const)
            : ('drifted' as const)
        }),
      )

      if (classifications.includes('drifted')) return { kind: 'drifted' }
      return classifications.includes('inconclusive') ? { kind: 'inconclusive' } : { kind: 'satisfied' }
    },
  }
}

function resolveStoredBatchPresence(
  recorded: { readonly postcondition: IdempotencyPostcondition; readonly receipt: IdempotencyReceiptEvidence },
  targetIds: readonly string[],
): ReadonlyMap<string, StoredBatchPresenceTarget> | undefined {
  if (recorded.postcondition.kind !== 'all-of' || !isIdempotencyCompositeReceiptSnapshot(recorded.receipt)) {
    return undefined
  }
  if (!isCanonicalAllOf(recorded.postcondition)) return undefined
  if (recorded.postcondition.items.length !== targetIds.length || recorded.receipt.items.length !== targetIds.length) {
    return undefined
  }

  const postconditions = indexBatchEvidenceByAgent(recorded.postcondition.items)
  const receipts = indexBatchEvidenceByAgent(recorded.receipt.items)
  if (
    !postconditions ||
    !receipts ||
    !sameTargetSet(postconditions, targetIds) ||
    !sameTargetSet(receipts, targetIds)
  ) {
    return undefined
  }

  const stored = new Map<string, StoredBatchPresenceTarget>()
  for (const targetId of targetIds) {
    const postcondition = postconditions.get(targetId)!
    const receipt = receipts.get(targetId)!
    if (
      postcondition.kind !== 'package-present' ||
      postcondition.providerId !== receipt.providerId ||
      postcondition.targetId !== receipt.targetId
    ) {
      return undefined
    }
    stored.set(targetId, { postcondition, receipt })
  }
  return stored
}

function isCanonicalAllOf(postcondition: IdempotencyAllOfPostcondition): boolean {
  try {
    return (
      fingerprintCanonicalValue(canonicalizeAllOfPostcondition(postcondition.items)) ===
      fingerprintCanonicalValue(postcondition)
    )
  } catch {
    return false
  }
}

function indexBatchEvidenceByAgent<T extends IdempotencyReceiptSnapshot | IdempotencySinglePostcondition>(
  items: readonly T[],
): ReadonlyMap<string, T> | undefined {
  const indexed = new Map<string, T>()
  for (const item of items) {
    const targetId = item.agentTargetId
    if (typeof targetId !== 'string' || targetId.length === 0 || indexed.has(targetId)) return undefined
    indexed.set(targetId, item)
  }
  return indexed
}

function sameTargetSet(values: ReadonlyMap<string, unknown>, targetIds: readonly string[]): boolean {
  return values.size === targetIds.length && targetIds.every(targetId => values.has(targetId))
}

function sortCandidateIdentities(candidates: readonly PresenceCandidateIdentity[]): PresenceCandidateIdentity[] {
  return [...candidates].sort((left, right) => {
    const leftFields = [left.providerId, left.targetKind, left.targetId, left.binaryName ?? '']
    const rightFields = [right.providerId, right.targetKind, right.targetId, right.binaryName ?? '']
    for (let index = 0; index < leftFields.length; index += 1) {
      const order = compareCodePoints(leftFields[index]!, rightFields[index]!)
      if (order !== 0) return order
    }
    return 0
  })
}

function compareCodePoints(left: string, right: string): number {
  const leftCodePoints = left[Symbol.iterator]()
  const rightCodePoints = right[Symbol.iterator]()
  while (true) {
    const leftNext = leftCodePoints.next()
    const rightNext = rightCodePoints.next()
    if (leftNext.done || rightNext.done) {
      if (leftNext.done === rightNext.done) return 0
      return leftNext.done ? -1 : 1
    }
    const difference = leftNext.value.codePointAt(0)! - rightNext.value.codePointAt(0)!
    if (difference !== 0) return difference
  }
}

export async function createAgentAbsenceIdempotencyPolicy(
  agentName: string,
  ports: AgentLifecyclePolicyPorts = {},
): Promise<CommandIdempotencyPolicy<unknown>> {
  const observe = ports.observe ?? resolveAgentObservation
  const observation = await observe(agentName)
  const targetId = observation?.agent.name ?? agentName
  const source = observation ? resolveVerifiedAbsenceSource(observation) : undefined
  const observeProviderTarget = ports.observeProviderTarget ?? observeExactProviderTarget
  const isExecutablePresent = ports.isExecutablePresent ?? isBinaryInPath

  return {
    async captureEvidence() {
      if (!source) return undefined
      const live = await safelyObserveProviderTarget(observeProviderTarget, source.binding)
      if (!isConclusiveExactAbsence(live, source.binding)) return undefined
      const executablePresent = await safelyInspectExecutable(isExecutablePresent, source.executableName)
      if (executablePresent !== false) return undefined

      return absenceEvidence(source)
    },
    request: canonicalizeMutationRequest({ action: 'uninstall', targets: [targetId] }),
    resolvedPlan: { kind: 'agent-absence', targetId },
    async validateLive(recorded) {
      if (!isSingleReplayEvidence(recorded)) return { kind: 'inconclusive' }
      const stored = resolveStoredAbsenceSource(
        { postcondition: recorded.postcondition, receipt: recorded.receipt },
        targetId,
      )
      if (!stored) return { kind: 'inconclusive' }
      const current = await safelyObserveAgent(observe, targetId)
      if (current.kind === 'failed' || !current.observation) return { kind: 'inconclusive' }
      const currentState = classifyCurrentAbsenceState(current.observation)
      if (currentState !== 'clear') return { kind: currentState }

      const live = await safelyObserveProviderTarget(observeProviderTarget, stored.binding)
      if (live.kind !== 'success' || !providerObservationMatches(stored.binding, live.value)) {
        return { kind: 'inconclusive' }
      }
      if (live.value.kind === 'present') return { kind: 'drifted' }

      const executablePresent = await safelyInspectExecutable(isExecutablePresent, stored.executableName)
      if (executablePresent === undefined) return { kind: 'inconclusive' }
      return executablePresent ? { kind: 'drifted' } : { kind: 'satisfied' }
    },
  }
}

function classifyCurrentAbsenceState(current: ResolvedAgentObservation): 'clear' | 'drifted' | 'inconclusive' {
  if (
    current.observation.kind === 'indeterminate' ||
    current.observation.drift.kind === 'indeterminate' ||
    current.observation.drift.kind === 'conflicting-source' ||
    (current.providerOutcome !== undefined && current.providerOutcome.kind !== 'success')
  ) {
    return 'inconclusive'
  }

  if (
    current.binding &&
    (current.providerOutcome?.kind !== 'success' ||
      !providerObservationMatches(current.binding, current.providerOutcome.value))
  ) {
    return 'inconclusive'
  }

  if (
    current.receipt ||
    current.installedState ||
    current.persistedBinding ||
    current.binding ||
    current.observation.kind === 'present' ||
    current.executable.present ||
    current.pathExecutable.present
  ) {
    return 'drifted'
  }

  return 'clear'
}

export async function createAgentPresenceIdempotencyPolicy(
  action: 'ensure' | 'install',
  agentName: string,
  ports: AgentLifecyclePolicyPorts = {},
): Promise<CommandIdempotencyPolicy<unknown>> {
  const observation = await (ports.observe ?? resolveAgentObservation)(agentName)
  const targetId = observation?.agent.name ?? agentName

  return {
    async captureEvidence() {
      const current = await (ports.observe ?? resolveAgentObservation)(targetId)
      if (!current) return undefined
      const classified = classifyPresenceEvidence(current)
      return classified.kind === 'compatible' ? classified.evidence : undefined
    },
    request: canonicalizeMutationRequest({ action, targets: [targetId] }),
    resolvedPlan: {
      candidates:
        observation?.catalogMethods.map(candidate => ({
          ...(candidate.target.binaryName ? { binaryName: candidate.target.binaryName } : {}),
          providerId: candidate.providerId,
          targetId: candidate.target.id,
          targetKind: candidate.target.kind,
        })) ?? [],
      kind: 'agent-presence',
      targetId,
    },
    async validateLive(recorded) {
      if (!isSingleReplayEvidence(recorded)) return { kind: 'inconclusive' }
      const current = await (ports.observe ?? resolveAgentObservation)(targetId)
      if (!current) return { kind: 'inconclusive' }

      const classified = classifyPresenceEvidence(current, recorded.receipt)
      if (classified.kind !== 'compatible') return { kind: classified.kind }

      return fingerprintCanonicalValue(classified.evidence) === fingerprintCanonicalValue(recorded)
        ? { kind: 'satisfied' }
        : { kind: 'drifted' }
    },
  }
}

function classifyPresenceEvidence(
  current: ResolvedAgentObservation,
  recordedReceipt?: IdempotencyReceiptSnapshot,
): PresenceEvidenceClassification {
  const { agent, binding, observation, providerOutcome, receipt } = current
  if (
    observation.kind === 'indeterminate' ||
    observation.drift.kind === 'indeterminate' ||
    providerOutcome === undefined ||
    providerOutcome.kind !== 'success'
  ) {
    return { kind: 'inconclusive' }
  }

  if (
    observation.kind !== 'present' ||
    observation.drift.kind !== 'none' ||
    !current.executable.present ||
    !binding ||
    !receipt ||
    providerOutcome.value.kind !== 'present' ||
    observation.providerId !== binding.providerId ||
    observation.providerTargetId !== binding.target.id ||
    receipt.targetId !== agent.name ||
    receipt.providerId !== binding.providerId ||
    receipt.providerTargetId !== binding.target.id ||
    (receipt.providerTargetKind !== undefined && receipt.providerTargetKind !== binding.target.kind) ||
    providerOutcome.value.target.id !== binding.target.id ||
    providerOutcome.value.target.kind !== binding.target.kind
  ) {
    return { kind: 'drifted' }
  }

  const liveVersions = uniqueDefined([current.executable.version, observation.version, providerOutcome.value.version])
  if (liveVersions.length > 1) return { kind: 'drifted' }
  const expectedVersions = uniqueDefined([receipt.version, recordedReceipt?.version])
  if (expectedVersions.length > 1) return { kind: 'drifted' }
  const expectedVersion = expectedVersions[0]
  if (expectedVersion !== undefined && liveVersions.some(version => version !== expectedVersion)) {
    return { kind: 'drifted' }
  }
  if (expectedVersion !== undefined && liveVersions.length === 0) return { kind: 'inconclusive' }

  const livePaths = uniqueDefined([
    current.executable.path,
    observation.executablePath,
    providerOutcome.value.executablePath,
  ])
  if (livePaths.length > 1) return { kind: 'drifted' }
  const expectedPaths = uniqueDefined([
    receipt.executablePath,
    getStringEvidenceField(recordedReceipt, 'executablePath'),
  ])
  if (expectedPaths.length > 1) return { kind: 'drifted' }
  const expectedPath = expectedPaths[0]
  if (expectedPath !== undefined && livePaths.some(path => path !== expectedPath)) {
    return { kind: 'drifted' }
  }
  if (expectedPath !== undefined && current.executable.path === undefined) return { kind: 'inconclusive' }

  const verifiedPath = expectedPath ?? livePaths[0]
  const verifiedVersion = expectedVersion ?? liveVersions[0]
  return {
    evidence: {
      postcondition: {
        agentTargetId: agent.name,
        kind: 'package-present',
        providerId: binding.providerId,
        targetId: binding.target.id,
      },
      receipt: {
        agentTargetId: agent.name,
        executableName: receipt.executableName ?? agent.binaryName,
        ...(verifiedPath ? { executablePath: verifiedPath } : {}),
        providerId: binding.providerId,
        providerTargetKind: binding.target.kind,
        schemaVersion: receipt.schemaVersion,
        targetId: binding.target.id,
        ...(verifiedVersion ? { version: verifiedVersion } : {}),
      },
    },
    kind: 'compatible',
  }
}

function uniqueDefined(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== undefined))]
}

function getStringEvidenceField(receipt: IdempotencyReceiptSnapshot | undefined, field: string): string | undefined {
  const value = receipt?.[field]
  return typeof value === 'string' ? value : undefined
}

function resolveStoredUpdateEvidence(
  recorded: { readonly postcondition: IdempotencyPostcondition; readonly receipt: IdempotencyReceiptEvidence },
  agentTargetId: string,
): StoredUpdateEvidence | undefined {
  if (!isSingleReplayEvidence(recorded) || recorded.postcondition.kind !== 'version-satisfies') return undefined
  const receiptAgentTargetId = getStringEvidenceField(recorded.receipt, 'agentTargetId')
  const postconditionAgentTargetId = getPostconditionStringField(recorded.postcondition, 'agentTargetId')
  const postconditionProviderId = getPostconditionStringField(recorded.postcondition, 'providerId')
  const postconditionProviderTargetKind = getPostconditionStringField(recorded.postcondition, 'providerTargetKind')
  const providerTargetKind = getStringEvidenceField(recorded.receipt, 'providerTargetKind')
  const providerId = recorded.receipt.providerId
  if (
    recorded.postcondition.expectedVersion.length === 0 ||
    compareVersions(recorded.postcondition.expectedVersion, recorded.postcondition.expectedVersion) === undefined ||
    receiptAgentTargetId !== agentTargetId ||
    postconditionAgentTargetId !== agentTargetId ||
    postconditionProviderId !== providerId ||
    postconditionProviderTargetKind !== providerTargetKind ||
    recorded.postcondition.targetId !== recorded.receipt.targetId ||
    !isProviderId(providerId) ||
    !isProviderTargetKind(providerTargetKind) ||
    !isValidProviderTargetKind(providerId, providerTargetKind)
  ) {
    return undefined
  }

  return {
    agentTargetId,
    expectedVersion: recorded.postcondition.expectedVersion,
    providerId,
    providerTargetId: recorded.receipt.targetId,
    providerTargetKind,
  }
}

function resolveStoredBatchUpdateEvidence(
  recorded: { readonly postcondition: IdempotencyPostcondition; readonly receipt: IdempotencyReceiptEvidence },
  targetIds: readonly string[],
): ReadonlyMap<string, StoredUpdateEvidence> | undefined {
  if (recorded.postcondition.kind !== 'all-of' || !isIdempotencyCompositeReceiptSnapshot(recorded.receipt)) {
    return undefined
  }
  if (!isCanonicalAllOf(recorded.postcondition)) return undefined
  if (recorded.postcondition.items.length !== targetIds.length || recorded.receipt.items.length !== targetIds.length) {
    return undefined
  }
  const postconditions = indexBatchEvidenceByAgent(recorded.postcondition.items)
  const receipts = indexBatchEvidenceByAgent(recorded.receipt.items)
  if (
    !postconditions ||
    !receipts ||
    !sameTargetSet(postconditions, targetIds) ||
    !sameTargetSet(receipts, targetIds)
  ) {
    return undefined
  }

  const stored = new Map<string, StoredUpdateEvidence>()
  for (const targetId of targetIds) {
    const resolved = resolveStoredUpdateEvidence(
      { postcondition: postconditions.get(targetId)!, receipt: receipts.get(targetId)! },
      targetId,
    )
    if (!resolved) return undefined
    stored.set(targetId, resolved)
  }
  return stored
}

function classifyUpdateObservation(
  current: LifecycleUpdateObservedAgent,
  plan: SingleAgentLifecycleUpdatePlan,
  receipt: LifecycleReceipt | undefined = current.receipt,
): UpdateObservationClassification {
  const expected: StoredUpdateEvidence = {
    agentTargetId: plan.before.agent.name,
    expectedVersion: plan.plannedTargetVersion,
    providerId: plan.binding.providerId,
    providerTargetId: plan.binding.target.id,
    providerTargetKind: plan.binding.target.kind,
  }
  const classification = classifyStoredUpdateObservation(current, expected, receipt)
  if (classification !== 'satisfied') return { kind: classification }
  if (current.observation.kind !== 'present' || !receipt) return { kind: 'inconclusive' }
  const observation = current.observation

  const versions = uniqueDefined([current.executable.version, observation.version])
  const verifiedVersion = versions[0]!
  return {
    evidence: {
      postcondition: {
        agentTargetId: expected.agentTargetId,
        expectedVersion: expected.expectedVersion,
        kind: 'version-satisfies',
        providerId: expected.providerId,
        providerTargetKind: expected.providerTargetKind,
        targetId: expected.providerTargetId,
      },
      receipt: {
        agentTargetId: expected.agentTargetId,
        executableName: receipt.executableName ?? current.agent.binaryName,
        ...(observation.executablePath ? { executablePath: observation.executablePath } : {}),
        providerId: expected.providerId,
        providerTargetKind: expected.providerTargetKind,
        schemaVersion: receipt.schemaVersion,
        targetId: expected.providerTargetId,
        version: verifiedVersion,
      },
    },
    kind: 'compatible',
  }
}

function classifyStoredUpdateObservation(
  current: LifecycleUpdateObservedAgent,
  expected: StoredUpdateEvidence,
  receipt: LifecycleReceipt | undefined = current.receipt,
): 'drifted' | 'inconclusive' | 'satisfied' {
  if (current.observation.kind === 'indeterminate' || current.observation.drift.kind === 'indeterminate') {
    return 'inconclusive'
  }
  if (
    current.agent.name !== expected.agentTargetId ||
    current.observation.kind !== 'present' ||
    current.observation.drift.kind !== 'none' ||
    !current.executable.present
  ) {
    return 'drifted'
  }
  if (!current.binding || !current.persistedBinding || !receipt) return 'inconclusive'
  const expectedBinding: LifecycleProviderBinding = {
    providerId: expected.providerId,
    target: { id: expected.providerTargetId, kind: expected.providerTargetKind },
  }
  if (
    !providerBindingsEqual(expectedBinding, current.binding, current.agent.binaryName) ||
    !providerBindingsEqual(expectedBinding, current.persistedBinding, current.agent.binaryName) ||
    current.observation.providerId !== expected.providerId ||
    current.observation.providerTargetId !== expected.providerTargetId ||
    current.observation.providerTargetKind !== expected.providerTargetKind ||
    receipt.targetId !== expected.agentTargetId ||
    receipt.providerId !== expected.providerId ||
    receipt.providerTargetId !== expected.providerTargetId ||
    receipt.providerTargetKind !== expected.providerTargetKind
  ) {
    return 'drifted'
  }

  const versions = uniqueDefined([current.executable.version, current.observation.version])
  if (versions.length === 0) return 'inconclusive'
  if (versions.length > 1) return 'drifted'
  const order = compareVersions(versions[0]!, expected.expectedVersion)
  if (order === undefined) return 'inconclusive'
  return order < 0 ? 'drifted' : 'satisfied'
}

async function safelyObserveUpdate(
  observe: SingleAgentLifecycleUpdateInvocation['observe'],
  agentName: string,
): Promise<
  | { readonly kind: 'failed' }
  | { readonly kind: 'success'; readonly observation: LifecycleUpdateObservedAgent | undefined }
> {
  try {
    return { kind: 'success', observation: await observe(agentName) }
  } catch {
    return { kind: 'failed' }
  }
}

function resolveVerifiedAbsenceSource(current: ResolvedAgentObservation): VerifiedAbsenceSource | undefined {
  const receiptBinding = current.receipt ? resolveReceiptProviderBinding(current.receipt) : undefined
  if (
    !receiptBinding ||
    !current.binding ||
    !providerBindingsEqual(receiptBinding, current.binding, current.agent.binaryName) ||
    current.providerOutcome?.kind !== 'success' ||
    !providerObservationMatches(receiptBinding, current.providerOutcome.value)
  ) {
    return undefined
  }

  return {
    agentTargetId: current.agent.name,
    binding: receiptBinding,
    executableName: current.receipt?.executableName ?? receiptBinding.target.binaryName ?? current.agent.binaryName,
    receiptSchemaVersion: current.receipt!.schemaVersion,
  }
}

function resolveStoredAbsenceSource(
  recorded: { readonly postcondition: IdempotencySinglePostcondition; readonly receipt: IdempotencyReceiptSnapshot },
  agentTargetId: string,
): Pick<VerifiedAbsenceSource, 'binding' | 'executableName'> | undefined {
  const recordedAgentTargetId = getStringEvidenceField(recorded.receipt, 'agentTargetId')
  const postconditionAgentTargetId = getPostconditionStringField(recorded.postcondition, 'agentTargetId')
  const executableName = getStringEvidenceField(recorded.receipt, 'executableName')
  const providerTargetKind = getStringEvidenceField(recorded.receipt, 'providerTargetKind')
  const providerId = recorded.receipt.providerId
  if (
    recorded.postcondition.kind !== 'package-absent' ||
    recorded.postcondition.providerId !== recorded.receipt.providerId ||
    recorded.postcondition.targetId !== recorded.receipt.targetId ||
    recordedAgentTargetId !== agentTargetId ||
    postconditionAgentTargetId !== agentTargetId ||
    !executableName ||
    !isProviderId(providerId) ||
    !isProviderTargetKind(providerTargetKind) ||
    !isValidProviderTargetKind(providerId, providerTargetKind)
  ) {
    return undefined
  }

  return {
    binding: {
      providerId,
      target: { binaryName: executableName, id: recorded.receipt.targetId, kind: providerTargetKind },
    },
    executableName,
  }
}

function absenceEvidence(source: VerifiedAbsenceSource): PresenceReplayEvidence {
  return {
    postcondition: {
      agentTargetId: source.agentTargetId,
      kind: 'package-absent',
      providerId: source.binding.providerId,
      targetId: source.binding.target.id,
    },
    receipt: {
      agentTargetId: source.agentTargetId,
      executableName: source.executableName,
      providerId: source.binding.providerId,
      providerTargetKind: source.binding.target.kind,
      schemaVersion: source.receiptSchemaVersion,
      targetId: source.binding.target.id,
    },
  }
}

async function observeExactProviderTarget(
  binding: LifecycleProviderBinding,
): Promise<ProviderOutcome<ProviderObservation>> {
  const operation = createCliOperationContext()
  try {
    return await operation.run(() =>
      observeLifecycleProvider(binding, {
        signal: operation.context.signal,
        timeoutMs: operation.context.timeoutMs,
      }),
    )
  } finally {
    operation.dispose()
  }
}

async function safelyObserveAgent(
  observe: (agentName: string) => Promise<ResolvedAgentObservation | undefined>,
  agentName: string,
): Promise<
  { readonly kind: 'failed' } | { readonly kind: 'success'; readonly observation: ResolvedAgentObservation | undefined }
> {
  try {
    return { kind: 'success', observation: await observe(agentName) }
  } catch {
    return { kind: 'failed' }
  }
}

async function safelyObserveProviderTarget(
  observe: (binding: LifecycleProviderBinding) => Promise<ProviderOutcome<ProviderObservation>>,
  binding: LifecycleProviderBinding,
): Promise<ProviderOutcome<ProviderObservation>> {
  try {
    return await observe(binding)
  } catch (error) {
    return { kind: 'failed', reason: error instanceof Error ? error.message : String(error), retryable: false }
  }
}

async function safelyInspectExecutable(
  inspect: (binaryName: string) => Promise<boolean>,
  binaryName: string,
): Promise<boolean | undefined> {
  try {
    return await inspect(binaryName)
  } catch {
    return undefined
  }
}

function isConclusiveExactAbsence(
  outcome: ProviderOutcome<ProviderObservation>,
  binding: LifecycleProviderBinding,
): boolean {
  return (
    outcome.kind === 'success' && outcome.value.kind === 'absent' && providerObservationMatches(binding, outcome.value)
  )
}

function providerObservationMatches(binding: LifecycleProviderBinding, observation: ProviderObservation): boolean {
  return binding.target.id === observation.target.id && binding.target.kind === observation.target.kind
}

function getPostconditionStringField(postcondition: IdempotencySinglePostcondition, field: string): string | undefined {
  const value = postcondition[field]
  return typeof value === 'string' ? value : undefined
}

function isSingleReplayEvidence(recorded: {
  readonly postcondition: IdempotencyPostcondition
  readonly receipt: IdempotencyReceiptEvidence
}): recorded is {
  readonly postcondition: IdempotencySinglePostcondition
  readonly receipt: IdempotencyReceiptSnapshot
} {
  return recorded.postcondition.kind !== 'all-of' && !isIdempotencyCompositeReceiptSnapshot(recorded.receipt)
}

function isProviderId(value: string): value is ProviderId {
  return firstPartyProviderIds.includes(value as ProviderId)
}

function isProviderTargetKind(value: string | undefined): value is ProviderTargetKind {
  return (
    value === 'binary' ||
    value === 'cask' ||
    value === 'formula' ||
    value === 'id' ||
    value === 'package' ||
    value === 'script' ||
    value === 'tool'
  )
}

function isValidProviderTargetKind(providerId: ProviderId, targetKind: ProviderTargetKind): boolean {
  switch (providerId) {
    case 'binary':
      return targetKind === 'binary'
    case 'script':
      return targetKind === 'script'
    case 'brew':
      return targetKind === 'formula' || targetKind === 'cask'
    case 'winget':
      return targetKind === 'id'
    case 'deno':
    case 'mise':
    case 'uv':
      return targetKind === 'tool'
    case 'bun':
    case 'cargo':
    case 'npm':
    case 'pip':
      return targetKind === 'package'
  }
}
