import type { InstallMethod } from '../agents'
import type {
  LifecycleObservation,
  LifecyclePlanningProvider,
  LifecyclePostcondition,
  LifecycleReceipt,
  LifecycleUpdatePlanningInput,
  LifecycleUpdatePlanningResult,
  LifecycleVerification,
} from '../lifecycle'
import type {
  ProviderAdapter,
  ProviderEvidence,
  ProviderId,
  ProviderMutationEvidence,
  ProviderOperation,
  ProviderOperationContext,
  ProviderOutcome,
  RegistryPackageOperationOptions,
  ProviderTarget,
} from '../providers/types'
import type { InstalledAgentState } from '../state'
import { LIFECYCLE_RECEIPT_SCHEMA_VERSION } from '../lifecycle'
import { compareVersions } from '../utils/version'

export interface LifecycleUpdateObservedAgent {
  readonly agent: {
    readonly binaryName: string
    readonly displayName: string
    readonly name: string
  }
  readonly binding?: {
    readonly providerId: ProviderId
    readonly target: ProviderTarget
  }
  readonly capabilities: readonly ProviderOperation[]
  readonly executable: {
    readonly path?: string
    readonly present: boolean
    readonly version?: string
  }
  readonly installedState?: InstalledAgentState
  readonly methods: readonly InstallMethod[]
  readonly observation: LifecycleObservation
  readonly persistedBinding?: {
    readonly providerId: ProviderId
    readonly target: ProviderTarget
  }
  readonly receipt?: LifecycleReceipt
}

export interface LifecycleUpdateProviderRegistryPort {
  get(id: ProviderId): ProviderAdapter | undefined
  getCapabilities(id: ProviderId): readonly ProviderOperation[]
}

export interface LifecycleUpdateServicePorts {
  readonly clock: () => string
  readonly dryRun: boolean
  readonly observe: (agentName: string) => Promise<LifecycleUpdateObservedAgent | undefined>
  readonly planLifecycleUpdate: (input: LifecycleUpdatePlanningInput) => LifecycleUpdatePlanningResult
  readonly providerRegistry: LifecycleUpdateProviderRegistryPort
  readonly registerCleanup?: ProviderOperationContext['registerCleanup']
  readonly signal: AbortSignal
  readonly timeoutMs?: number
  readonly updateOptions?: RegistryPackageOperationOptions
  readonly withMutationLock?: <T>(run: () => Promise<T>) => Promise<T>
  readonly writeReceipt: (receipt: LifecycleReceipt) => Promise<void>
}

export interface LifecycleUpdateBatchPlanningPorts extends LifecycleUpdateServicePorts {
  readonly listRegisteredAgentNames: () => Promise<readonly string[]> | readonly string[]
}

export interface LifecycleUpdateBatchTargetPlan {
  readonly agentName: string
  readonly id: string
  readonly outcome: SingleAgentLifecycleUpdatePlanningOutcome
}

export interface LifecycleUpdateProviderBucket {
  readonly id: string
  readonly providerId: ProviderId
  readonly targets: readonly LifecycleUpdateBatchTargetPlan[]
}

export interface LifecycleUpdateBatchPlan {
  readonly id: string
  readonly kind: 'lifecycle-update-batch-plan'
  readonly providerBuckets: readonly LifecycleUpdateProviderBucket[]
  readonly resolvedPlanId: string
  readonly targets: readonly LifecycleUpdateBatchTargetPlan[]
}

export interface SingleAgentLifecycleUpdatePlan {
  readonly before: LifecycleUpdateObservedAgent
  readonly binding: {
    readonly providerId: ProviderId
    readonly target: ProviderTarget
  }
  readonly plannedTargetVersion: string
  readonly planning: LifecycleUpdatePlanningResult
  readonly providerOptions?: RegistryPackageOperationOptions
}

export type LifecycleUpdateBlockedCategory = 'manual-required' | 'unsafe-source' | 'untracked'

export type SingleAgentLifecycleUpdatePlanningOutcome =
  | { readonly kind: 'unknown-agent'; readonly agentName: string }
  | {
      readonly before: LifecycleUpdateObservedAgent
      readonly category: LifecycleUpdateBlockedCategory
      readonly kind: 'blocked'
      readonly reason: string
    }
  | {
      readonly before: LifecycleUpdateObservedAgent
      readonly kind: 'cancelled'
      readonly reason?: string
    }
  | {
      readonly before: LifecycleUpdateObservedAgent
      readonly kind: 'timed-out'
      readonly timeoutMs: number
    }
  | {
      readonly before: LifecycleUpdateObservedAgent
      readonly kind: 'provider-failed'
      readonly providerOutcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>
    }
  | { readonly kind: 'planned'; readonly planned: SingleAgentLifecycleUpdatePlan }

export type SingleAgentLifecycleUpdateExecutionOutcome =
  | {
      readonly after?: LifecycleUpdateObservedAgent
      readonly kind: 'cancelled'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly providerOutcome?: ProviderOutcome<ProviderMutationEvidence>
      readonly reason?: string
    }
  | { readonly kind: 'dry-run'; readonly plan: SingleAgentLifecycleUpdatePlan }
  | {
      readonly kind: 'not-executed'
      readonly plan: SingleAgentLifecycleUpdatePlan
    }
  | {
      readonly after?: LifecycleUpdateObservedAgent
      readonly kind: 'provider-failed'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly providerOutcome: Exclude<ProviderOutcome<ProviderMutationEvidence>, { readonly kind: 'success' }>
    }
  | {
      readonly kind: 'timed-out'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly providerOutcome: Extract<ProviderOutcome<ProviderMutationEvidence>, { readonly kind: 'timed-out' }>
      readonly timeoutMs: number
    }
  | {
      readonly after?: LifecycleUpdateObservedAgent
      readonly kind: 'verification-failed'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly providerOutcome: Extract<ProviderOutcome<ProviderMutationEvidence>, { readonly kind: 'success' }>
      readonly verification: Exclude<LifecycleVerification, { readonly kind: 'satisfied' }>
    }
  | {
      readonly after: LifecycleUpdateObservedAgent
      readonly kind: 'receipt-failed'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly providerOutcome: Extract<ProviderOutcome<ProviderMutationEvidence>, { readonly kind: 'success' }>
      readonly reason: string
      readonly verification: Extract<LifecycleVerification, { readonly kind: 'satisfied' }>
    }
  | {
      readonly after: LifecycleUpdateObservedAgent
      readonly kind: 'updated'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly providerOutcome: Extract<ProviderOutcome<ProviderMutationEvidence>, { readonly kind: 'success' }>
      readonly receipt: LifecycleReceipt
      readonly verification: Extract<LifecycleVerification, { readonly kind: 'satisfied' }>
    }

export interface LifecycleUpdateMutationLockEvidence {
  readonly reason: string
  readonly resource: string
}

export interface LifecycleUpdateBatchExecutionPorts extends LifecycleUpdateServicePorts {
  readonly classifyMutationLockError: (error: unknown) => LifecycleUpdateMutationLockEvidence | undefined
}

export type LifecycleUpdateBatchTargetExecutionOutcome =
  | SingleAgentLifecycleUpdateExecutionOutcome
  | {
      readonly kind: 'locked'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly reason: string
      readonly resource: string
    }
  | {
      readonly kind: 'unexpected-failure'
      readonly plan: SingleAgentLifecycleUpdatePlan
      readonly reason: string
    }

export interface LifecycleUpdateBatchTargetOutcome {
  readonly agentName: string
  readonly execution?: LifecycleUpdateBatchTargetExecutionOutcome
  readonly id: string
  readonly planning: SingleAgentLifecycleUpdatePlanningOutcome
}

export interface LifecycleUpdateBatchCancellationRemainder {
  readonly agentName: string
  readonly id: string
  readonly planning: Extract<SingleAgentLifecycleUpdatePlanningOutcome, { readonly kind: 'planned' }>
  readonly reason?: string
}

export interface LifecycleUpdateBatchOutcome {
  readonly cancellationRemainder: readonly LifecycleUpdateBatchCancellationRemainder[]
  readonly kind: 'lifecycle-update-batch-outcome'
  readonly plan: LifecycleUpdateBatchPlan
  readonly results: readonly LifecycleUpdateBatchTargetOutcome[]
  readonly success: boolean
}

export async function executeLifecycleUpdateBatch(
  plan: LifecycleUpdateBatchPlan,
  ports: LifecycleUpdateBatchExecutionPorts,
): Promise<LifecycleUpdateBatchOutcome> {
  const results: LifecycleUpdateBatchTargetOutcome[] = []
  const cancellationRemainder: LifecycleUpdateBatchCancellationRemainder[] = []

  for (const target of plan.targets) {
    const planning = target.outcome
    if (planning.kind !== 'planned') {
      results.push({ agentName: target.agentName, id: target.id, planning })
      continue
    }
    if (ports.signal.aborted) {
      cancellationRemainder.push({
        agentName: target.agentName,
        id: target.id,
        planning,
        reason: abortReason(ports.signal),
      })
      continue
    }

    let execution: LifecycleUpdateBatchTargetExecutionOutcome
    try {
      execution = await executeSingleAgentLifecycleUpdate(planning.planned, ports)
    } catch (error) {
      const locked = ports.classifyMutationLockError(error)
      execution = locked
        ? { kind: 'locked', plan: planning.planned, reason: locked.reason, resource: locked.resource }
        : { kind: 'unexpected-failure', plan: planning.planned, reason: unexpectedFailureReason(error) }
    }
    results.push({ agentName: target.agentName, execution, id: target.id, planning })
  }

  return {
    cancellationRemainder,
    kind: 'lifecycle-update-batch-outcome',
    plan,
    results,
    success:
      cancellationRemainder.length === 0 &&
      results.length === plan.targets.length &&
      results.every(result => isSuccessfulBatchTarget(result)),
  }
}

function isSuccessfulBatchTarget(target: LifecycleUpdateBatchTargetOutcome): boolean {
  const kind = target.execution?.kind
  return kind === 'dry-run' || kind === 'not-executed' || kind === 'updated'
}

export async function planRegisteredAgentUpdates(
  ports: LifecycleUpdateBatchPlanningPorts,
): Promise<LifecycleUpdateBatchPlan> {
  const agentNames = [...new Set(await ports.listRegisteredAgentNames())].sort(compareCanonicalText)
  const targets: LifecycleUpdateBatchTargetPlan[] = []

  for (const agentName of agentNames) {
    const outcome = await planSingleAgentLifecycleUpdate(agentName, ports)
    if (isNormallyAbsentCatalogTarget(outcome)) continue
    targets.push({ agentName, id: getSingleAgentLifecycleUpdateResolvedPlanId(agentName, outcome), outcome })
  }

  const bucketTargets = new Map<string, LifecycleUpdateBatchTargetPlan[]>()
  for (const target of targets) {
    const compatibilityId = automaticProviderCompatibilityId(target)
    if (!compatibilityId) continue
    const entries = bucketTargets.get(compatibilityId) ?? []
    entries.push(target)
    bucketTargets.set(compatibilityId, entries)
  }

  const providerBuckets = [...bucketTargets.entries()]
    .sort(([left], [right]) => compareCanonicalText(left, right))
    .map(([compatibilityId, entries]): LifecycleUpdateProviderBucket => {
      const planned = entries[0]!.outcome
      if (planned.kind !== 'planned') throw new Error('Automatic update bucket contains a non-planned target.')
      return {
        id: `update-bucket:${compatibilityId};targets=${entries.map(entry => entry.id).join(',')}`,
        providerId: planned.planned.binding.providerId,
        targets: entries,
      }
    })
  const resolvedPlanId = `update-batch:targets=${targets.map(target => target.id).join(',')};buckets=${providerBuckets
    .map(bucket => bucket.id)
    .join(',')}`

  return {
    id: resolvedPlanId,
    kind: 'lifecycle-update-batch-plan',
    providerBuckets,
    resolvedPlanId,
    targets,
  }
}

function isNormallyAbsentCatalogTarget(outcome: SingleAgentLifecycleUpdatePlanningOutcome): boolean {
  if (outcome.kind !== 'blocked' || outcome.category !== 'unsafe-source') return false
  const before = outcome.before
  return (
    before.observation.kind === 'absent' &&
    before.observation.drift.kind === 'none' &&
    !before.executable.present &&
    before.binding === undefined &&
    before.persistedBinding === undefined &&
    before.installedState === undefined &&
    before.receipt === undefined
  )
}

export async function planSingleAgentLifecycleUpdate(
  agentName: string,
  ports: LifecycleUpdateServicePorts,
): Promise<SingleAgentLifecycleUpdatePlanningOutcome> {
  const before = await ports.observe(agentName)
  if (!before) return { agentName, kind: 'unknown-agent' }
  if (ports.signal.aborted) return { before, kind: 'cancelled', reason: abortReason(ports.signal) }

  const binding = confirmedBinding(before)
  if (!binding) {
    return {
      before,
      category: before.observation.drift.kind === 'untracked' ? 'untracked' : 'unsafe-source',
      kind: 'blocked',
      reason: 'The recorded update source does not match live provider evidence.',
    }
  }

  const adapter = ports.providerRegistry.get(binding.providerId)
  if (!adapter?.resolveLatestVersion) {
    return {
      before,
      category: 'manual-required',
      kind: 'blocked',
      reason: `Provider ${binding.providerId} cannot resolve an update target version.`,
    }
  }

  const resolved = await adapter.resolveLatestVersion({
    context: operationContext(ports),
    target: binding.target,
  })
  if (resolved.kind !== 'success') return planningProviderFailure(before, resolved)

  const provider: LifecyclePlanningProvider = {
    capabilities: ports.providerRegistry.getCapabilities(binding.providerId),
    providerId: binding.providerId,
    targetId: binding.target.id,
    targetKind: binding.target.kind,
  }
  const planning = ports.planLifecycleUpdate({
    intent: {
      kind: 'update',
      targetId: before.agent.name,
      targetVersion: resolved.value.version,
    },
    observation: before.observation,
    provider,
  })

  return {
    kind: 'planned',
    planned: {
      before,
      binding,
      plannedTargetVersion: resolved.value.version,
      planning,
      providerOptions: ports.updateOptions,
    },
  }
}

export async function executeSingleAgentLifecycleUpdate(
  planned: SingleAgentLifecycleUpdatePlan,
  ports: LifecycleUpdateServicePorts,
): Promise<SingleAgentLifecycleUpdateExecutionOutcome> {
  if (planned.planning.decision !== 'upgrade') return { kind: 'not-executed', plan: planned }
  if (ports.dryRun) return { kind: 'dry-run', plan: planned }
  if (ports.signal.aborted) {
    return { kind: 'cancelled', plan: planned, reason: abortReason(ports.signal) }
  }

  const execute = () => executeLockedSingleAgentLifecycleUpdate(planned, ports)
  return ports.withMutationLock ? ports.withMutationLock(execute) : execute()
}

async function executeLockedSingleAgentLifecycleUpdate(
  planned: SingleAgentLifecycleUpdatePlan,
  ports: LifecycleUpdateServicePorts,
): Promise<SingleAgentLifecycleUpdateExecutionOutcome> {
  const adapter = ports.providerRegistry.get(planned.binding.providerId)
  if (!adapter?.update) {
    return {
      kind: 'provider-failed',
      plan: planned,
      providerOutcome: {
        kind: 'unsupported',
        operation: 'update',
        reason: `Provider ${planned.binding.providerId} does not support update.`,
      },
    }
  }

  const providerOutcome = await adapter.update({
    context: operationContext(ports),
    options: planned.providerOptions,
    target: planned.binding.target,
  })
  if (providerOutcome.kind === 'timed-out') {
    return { kind: 'timed-out', plan: planned, providerOutcome, timeoutMs: providerOutcome.timeoutMs }
  }
  if (providerOutcome.kind === 'cancelled') {
    return { kind: 'cancelled', plan: planned, providerOutcome, reason: providerOutcome.reason }
  }
  if (providerOutcome.kind !== 'success') {
    return { kind: 'provider-failed', plan: planned, providerOutcome }
  }
  if (ports.signal.aborted) {
    return { kind: 'cancelled', plan: planned, providerOutcome, reason: abortReason(ports.signal) }
  }

  const after = await ports.observe(planned.before.agent.name)
  if (ports.signal.aborted) {
    return { after, kind: 'cancelled', plan: planned, providerOutcome, reason: abortReason(ports.signal) }
  }
  const verification = verifyUpdatedObservation(planned, after)
  if (verification.kind !== 'satisfied') {
    return { after, kind: 'verification-failed', plan: planned, providerOutcome, verification }
  }

  const receipt = createReceipt(planned, after!, ports.clock())
  try {
    await ports.writeReceipt(receipt)
  } catch (error) {
    return {
      after: after!,
      kind: 'receipt-failed',
      plan: planned,
      providerOutcome,
      reason: safeErrorReason(error),
      verification,
    }
  }

  return { after: after!, kind: 'updated', plan: planned, providerOutcome, receipt, verification }
}

function confirmedBinding(
  observed: LifecycleUpdateObservedAgent,
): SingleAgentLifecycleUpdatePlan['binding'] | undefined {
  const binding = observed.binding
  const persistedBinding = observed.persistedBinding
  const observation = observed.observation
  if (!binding || !persistedBinding || observation.kind !== 'present' || observation.drift.kind !== 'none') {
    return undefined
  }
  if (!sameBinding(binding, persistedBinding, observed.agent.binaryName)) return undefined
  if (
    observation.providerId !== binding.providerId ||
    observation.providerTargetId !== binding.target.id ||
    observation.providerTargetKind !== binding.target.kind
  ) {
    return undefined
  }
  return binding
}

function verifyUpdatedObservation(
  planned: SingleAgentLifecycleUpdatePlan,
  after: LifecycleUpdateObservedAgent | undefined,
): LifecycleVerification {
  const postcondition: LifecyclePostcondition = {
    expectedVersion: planned.plannedTargetVersion,
    kind: 'version-satisfies',
    targetId: planned.binding.target.id,
  }
  if (!after) return { kind: 'indeterminate', postcondition, reason: 'The agent disappeared after update.' }
  if (!sameBinding(planned.binding, after.binding)) {
    return {
      kind: 'unsatisfied',
      observation: after.observation,
      postcondition,
      reason: 'Fresh observation no longer matches the planned provider binding.',
    }
  }
  if (after.observation.drift.kind !== 'none') {
    return {
      kind: 'unsatisfied',
      observation: after.observation,
      postcondition,
      reason: `Fresh observation contains ${after.observation.drift.kind} drift.`,
    }
  }
  if (after.observation.kind !== 'present' || !after.executable.present) {
    return {
      kind: 'unsatisfied',
      observation: after.observation,
      postcondition,
      reason: 'The provider target or executable is not present after update.',
    }
  }
  const versions = [after.observation.version, after.executable.version].filter(
    (version): version is string => version !== undefined,
  )
  const version = versions[0]
  if (version !== undefined && versions.some(candidate => compareVersions(candidate, version) !== 0)) {
    return {
      kind: 'unsatisfied',
      observation: after.observation,
      postcondition,
      reason: `Fresh observation contains conflicting versions: ${versions.join(', ')}.`,
    }
  }
  if (
    version === undefined ||
    versions.some(candidate => (compareVersions(candidate, planned.plannedTargetVersion) ?? -1) < 0)
  ) {
    return {
      kind: 'unsatisfied',
      observation: after.observation,
      postcondition,
      reason: `Observed version ${version ?? 'unknown'} does not satisfy target ${planned.plannedTargetVersion}.`,
    }
  }
  return { kind: 'satisfied', observation: after.observation, postcondition }
}

function createReceipt(
  planned: SingleAgentLifecycleUpdatePlan,
  after: LifecycleUpdateObservedAgent,
  verifiedAt: string,
): LifecycleReceipt {
  const observation = after.observation as Extract<LifecycleObservation, { readonly kind: 'present' }>
  return {
    executableName: after.agent.binaryName,
    ...(observation.executablePath ? { executablePath: observation.executablePath } : {}),
    kind: 'lifecycle-receipt',
    providerId: planned.binding.providerId,
    providerTargetId: planned.binding.target.id,
    providerTargetKind: planned.binding.target.kind,
    schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
    targetId: planned.before.agent.name,
    verifiedAt,
    version: observation.version ?? after.executable.version,
  }
}

function operationContext(ports: LifecycleUpdateServicePorts) {
  return { registerCleanup: ports.registerCleanup, signal: ports.signal, timeoutMs: ports.timeoutMs }
}

function planningProviderFailure(
  before: LifecycleUpdateObservedAgent,
  outcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>,
): SingleAgentLifecycleUpdatePlanningOutcome {
  if (outcome.kind === 'cancelled') return { before, kind: 'cancelled', reason: outcome.reason }
  if (outcome.kind === 'timed-out') return { before, kind: 'timed-out', timeoutMs: outcome.timeoutMs }
  return { before, kind: 'provider-failed', providerOutcome: outcome }
}

export function getSingleAgentLifecycleUpdateResolvedPlanId(
  agentName: string,
  outcome: SingleAgentLifecycleUpdatePlanningOutcome,
): string {
  const prefix = `update-target:agent=${identityPart(agentName)};outcome=${outcome.kind}`
  if (outcome.kind === 'planned') {
    const { binding, plannedTargetVersion, planning, providerOptions } = outcome.planned
    return `${prefix};provider=${identityPart(binding.providerId)};providerTargetKind=${identityPart(
      binding.target.kind,
    )};providerTarget=${identityPart(binding.target.id)};binary=${identityPart(
      binding.target.binaryName,
    )};decision=${planning.decision};plan=${identityPart(planning.plan.id)};version=${identityPart(
      plannedTargetVersion,
    )};${providerOptionsIdentity(providerOptions)}`
  }
  if (outcome.kind === 'unknown-agent') return `${prefix};agentName=${identityPart(outcome.agentName)}`
  if (outcome.kind === 'blocked') {
    return `${prefix};category=${outcome.category};reason=${identityPart(outcome.reason)}`
  }
  if (outcome.kind === 'cancelled') return `${prefix};reason=${identityPart(outcome.reason)}`
  if (outcome.kind === 'timed-out') return `${prefix};timeoutMs=${outcome.timeoutMs}`
  return `${prefix};providerOutcome=${providerOutcomeIdentity(outcome.providerOutcome)}`
}

function providerOutcomeIdentity(outcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>): string {
  switch (outcome.kind) {
    case 'unsupported':
      return `unsupported;operation=${identityPart(outcome.operation)};reason=${identityPart(outcome.reason)}`
    case 'unavailable':
      return `unavailable;command=${commandIdentity(outcome.command)};reason=${identityPart(
        outcome.reason,
      )};retryable=${identityPart(outcome.retryable)}`
    case 'failed':
      return `failed;command=${commandIdentity(outcome.command)};evidence=${evidenceIdentity(
        outcome.evidence,
      )};exitCode=${identityPart(outcome.exitCode)};reason=${identityPart(
        outcome.reason,
      )};remediation=${identityPart(outcome.remediation)};retryable=${identityPart(outcome.retryable)}`
    case 'cancelled':
      return `cancelled;reason=${identityPart(outcome.reason)}`
    case 'timed-out':
      return `timed-out;timeoutMs=${identityPart(outcome.timeoutMs)}`
    case 'indeterminate':
      return `indeterminate;evidence=${evidenceIdentity(outcome.evidence)};reason=${identityPart(outcome.reason)}`
  }
}

function commandIdentity(command: readonly string[] | undefined): string {
  return command ? `argv:${command.map(identityPart).join(',')}` : 'undefined'
}

function evidenceIdentity(evidence: readonly ProviderEvidence[] | undefined): string {
  if (!evidence) return 'undefined'
  return `items:${evidence
    .map(item => `kind=${identityPart(item.kind)}:value=${identityPart(item.value)}`)
    .sort(compareCanonicalText)
    .join(',')}`
}

function automaticProviderCompatibilityId(target: LifecycleUpdateBatchTargetPlan): string | undefined {
  if (target.outcome.kind !== 'planned' || target.outcome.planned.planning.decision !== 'upgrade') return undefined
  const planned = target.outcome.planned
  return `provider=${identityPart(planned.binding.providerId)};${providerOptionsIdentity(planned.providerOptions)}`
}

function providerOptionsIdentity(options: RegistryPackageOperationOptions | undefined): string {
  return `distTag=${identityPart(options?.distTag)};registry=${identityPart(
    options?.registry,
  )};updateStrategy=${identityPart(options?.updateStrategy)}`
}

function identityPart(value: boolean | number | string | null | undefined): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'boolean:true' : 'boolean:false'
  if (typeof value === 'number') return `number:${value}`
  return `string:${encodeURIComponent(value)}`
}

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sameBinding(
  expected: SingleAgentLifecycleUpdatePlan['binding'],
  actual: LifecycleUpdateObservedAgent['binding'],
  defaultExecutableName?: string,
): boolean {
  return Boolean(
    actual &&
    actual.providerId === expected.providerId &&
    actual.target.id === expected.target.id &&
    actual.target.kind === expected.target.kind &&
    (actual.target.binaryName ?? defaultExecutableName) === (expected.target.binaryName ?? defaultExecutableName),
  )
}

function abortReason(signal: AbortSignal): string | undefined {
  if (signal.reason === undefined) return undefined
  return signal.reason instanceof Error ? signal.reason.message : String(signal.reason)
}

function safeErrorReason(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'Failed to persist lifecycle receipt.'
}

function unexpectedFailureReason(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'Unexpected lifecycle update failure.'
}
