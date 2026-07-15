import type {
  LifecycleIntent,
  LifecycleObservation,
  LifecyclePlan,
  LifecyclePlanningProvider,
  LifecycleStep,
  ProviderCapability,
} from './model'
import { compareVersions } from '../utils/version'

export type LifecycleUpdateDecision =
  | 'blocked-downgrade'
  | 'blocked-source'
  | 'indeterminate'
  | 'manual-required'
  | 'up-to-date'
  | 'upgrade'

export interface LifecycleUpdatePlanningInput {
  readonly intent: Extract<LifecycleIntent, { kind: 'update' }>
  readonly observation: LifecycleObservation
  readonly provider?: LifecyclePlanningProvider
}

export interface LifecycleUpdatePlanningResult {
  readonly decision: LifecycleUpdateDecision
  readonly plan: LifecyclePlan
}

const automaticUpdateCapabilities = ['observe', 'update', 'verify'] as const

export function projectLifecycleProviderCapabilities(
  provider: LifecyclePlanningProvider,
): readonly ProviderCapability[] {
  return provider.capabilities.map((capability): ProviderCapability => `${provider.providerId}-${capability}`)
}

export function planLifecycleUpdate(input: LifecycleUpdatePlanningInput): LifecycleUpdatePlanningResult {
  const provider = reconcileProvider(input)
  const decision = decideUpdate(input, provider)

  return {
    decision,
    plan: {
      id: `update-${input.intent.targetId}`,
      intent: input.intent,
      kind: 'lifecycle-plan',
      observation: input.observation,
      steps: decision === 'upgrade' ? [createUpdateStep(input, provider!)] : [],
    },
  }
}

function decideUpdate(
  input: LifecycleUpdatePlanningInput,
  provider: LifecyclePlanningProvider | undefined,
): LifecycleUpdateDecision {
  const { observation } = input

  if (hasConflictingSource(input)) return 'blocked-source'
  if (observation.kind !== 'present' || observation.drift.kind === 'indeterminate') return 'indeterminate'

  const targetVersion = input.intent.targetVersion
  if (!observation.version || !targetVersion) return 'indeterminate'

  const order = compareVersions(targetVersion, observation.version)
  if (order === undefined) return 'indeterminate'
  if (order < 0) return 'blocked-downgrade'
  if (order === 0) return 'up-to-date'
  if (!provider || !automaticUpdateCapabilities.every(capability => provider.capabilities.includes(capability))) {
    return 'manual-required'
  }

  return 'upgrade'
}

function reconcileProvider(input: LifecycleUpdatePlanningInput): LifecyclePlanningProvider | undefined {
  if (hasConflictingSource(input)) return undefined
  return input.provider
}

function hasConflictingSource(input: LifecycleUpdatePlanningInput): boolean {
  const { observation, provider } = input
  if (observation.targetId !== input.intent.targetId) return true
  if (observation.drift.kind === 'conflicting-source') return true
  if (observation.kind !== 'present' || !provider) return false

  return (
    observation.providerId !== provider.providerId ||
    observation.providerTargetId !== provider.targetId ||
    observation.providerTargetKind !== provider.targetKind
  )
}

function createUpdateStep(input: LifecycleUpdatePlanningInput, provider: LifecyclePlanningProvider): LifecycleStep {
  return {
    dependsOn: [],
    effects: [
      {
        capability: `${provider.providerId}-observe`,
        kind: 'provider-observation',
        providerId: provider.providerId,
        targetId: provider.targetId,
      },
      {
        capability: `${provider.providerId}-update`,
        kind: 'provider-mutation',
        providerId: provider.providerId,
        targetId: provider.targetId,
      },
      {
        capability: `${provider.providerId}-verify`,
        kind: 'provider-observation',
        providerId: provider.providerId,
        targetId: provider.targetId,
      },
    ],
    id: `update-${input.intent.targetId}`,
    kind: 'operation',
    postconditions: [
      {
        expectedVersion: input.intent.targetVersion!,
        kind: 'version-satisfies',
        targetId: provider.targetId,
      },
    ],
    preconditions: [],
  }
}
