import type {
  LifecycleIntent,
  LifecycleObservation,
  LifecyclePlan,
  LifecyclePlanningProvider,
  LifecyclePostcondition,
  LifecycleStep,
} from './model'

export type LifecycleMutationDecision =
  | 'adopt'
  | 'blocked'
  | 'clear-ghost'
  | 'install'
  | 'preserve-unmanaged'
  | 'satisfied'
  | 'unsupported'
  | 'uninstall'

export interface LifecycleMutationPlanningInput {
  readonly intent: LifecycleIntent
  readonly observation: LifecycleObservation
  readonly provider?: LifecyclePlanningProvider
  /** Compatibility fields for the already-migrated Phase 6 mutation paths. */
  readonly providerId?: string
  readonly providerTargetId?: string
}

export interface LifecycleMutationPlanningResult {
  readonly decision: LifecycleMutationDecision
  readonly plan: LifecyclePlan
}

export function planLifecycleMutation(input: LifecycleMutationPlanningInput): LifecycleMutationPlanningResult {
  const decision = decideMutation(input)
  const plan: LifecyclePlan = {
    id: `${input.intent.kind}-${input.intent.targetId}`,
    intent: input.intent,
    kind: 'lifecycle-plan',
    observation: input.observation,
    steps: createSteps(decision, input),
  }

  return { decision, plan }
}

function decideMutation(input: LifecycleMutationPlanningInput): LifecycleMutationDecision {
  const { intent, observation } = input

  if (observation.kind === 'indeterminate' || observation.drift.kind === 'indeterminate') return 'blocked'
  if (observation.drift.kind === 'conflicting-source') return 'blocked'
  if (providerContextConflicts(input)) return 'blocked'

  if (intent.kind === 'uninstall') {
    if (observation.kind === 'absent') {
      return observation.drift.kind === 'recorded-absent' ? 'clear-ghost' : 'preserve-unmanaged'
    }
    if (!observation.providerId || !providerTargetId(input)) return 'preserve-unmanaged'
    return supports(input, 'uninstall') ? 'uninstall' : 'unsupported'
  }

  if (observation.kind === 'present') {
    if (observation.drift.kind === 'untracked') {
      return observation.providerId ? 'adopt' : 'preserve-unmanaged'
    }
    return 'satisfied'
  }

  if (!providerId(input) || !providerTargetId(input)) return 'blocked'
  return supports(input, 'install') ? 'install' : 'unsupported'
}

function providerContextConflicts(input: LifecycleMutationPlanningInput): boolean {
  const { observation, provider } = input
  if (observation.kind !== 'present' || provider === undefined) return false

  return (
    (observation.providerId !== undefined && observation.providerId !== provider.providerId) ||
    (observation.providerTargetId !== undefined && observation.providerTargetId !== provider.targetId) ||
    (observation.providerTargetKind !== undefined && observation.providerTargetKind !== provider.targetKind)
  )
}

function supports(input: LifecycleMutationPlanningInput, operation: 'install' | 'uninstall'): boolean {
  return input.provider === undefined || input.provider.capabilities.includes(operation)
}

function createSteps(
  decision: LifecycleMutationDecision,
  input: LifecycleMutationPlanningInput,
): readonly LifecycleStep[] {
  switch (decision) {
    case 'install':
      return [providerMutationStep('install', input, packagePostcondition('package-present', input))]
    case 'uninstall':
      return [providerMutationStep('uninstall', input, packagePostcondition('package-absent', input))]
    case 'adopt':
      return [
        operationStep(`adopt-${input.intent.targetId}`, [
          {
            executable:
              input.observation.kind === 'present'
                ? (input.observation.executablePath ?? input.intent.targetId)
                : input.intent.targetId,
            kind: 'executable-present',
          },
        ]),
      ]
    case 'clear-ghost':
      return [operationStep(`clear-ghost-${input.intent.targetId}`, [])]
    case 'blocked':
    case 'preserve-unmanaged':
    case 'satisfied':
    case 'unsupported':
      return []
  }
}

function providerMutationStep(
  operation: 'install' | 'uninstall',
  input: LifecycleMutationPlanningInput,
  postcondition: LifecyclePostcondition,
): LifecycleStep {
  const resolvedProviderId = providerId(input)!
  const resolvedProviderTargetId = providerTargetId(input)!

  return {
    dependsOn: [],
    effects: [
      {
        capability: `${resolvedProviderId}-${operation}`,
        kind: 'provider-mutation',
        providerId: resolvedProviderId,
        targetId: resolvedProviderTargetId,
      },
    ],
    id: `${operation}-${input.intent.targetId}`,
    kind: 'operation',
    postconditions: [postcondition],
    preconditions: [],
  }
}

function packagePostcondition(
  kind: 'package-absent' | 'package-present',
  input: LifecycleMutationPlanningInput,
): LifecyclePostcondition {
  return {
    kind,
    providerId: providerId(input)!,
    targetId: providerTargetId(input)!,
  }
}

function providerId(input: LifecycleMutationPlanningInput): string | undefined {
  return input.observation.kind === 'present'
    ? (input.observation.providerId ?? input.provider?.providerId ?? input.providerId)
    : (input.provider?.providerId ?? input.providerId)
}

function providerTargetId(input: LifecycleMutationPlanningInput): string | undefined {
  return input.observation.kind === 'present'
    ? (input.observation.providerTargetId ?? input.provider?.targetId ?? input.providerTargetId)
    : (input.provider?.targetId ?? input.providerTargetId)
}

function operationStep(id: string, postconditions: readonly LifecyclePostcondition[]): LifecycleStep {
  return {
    dependsOn: [],
    effects: [],
    id,
    kind: 'operation',
    postconditions,
    preconditions: [],
  }
}
