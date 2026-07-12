import type {
  LifecycleIntent,
  LifecycleObservation,
  LifecyclePlan,
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
  | 'uninstall'

export interface LifecycleMutationPlanningInput {
  readonly intent: LifecycleIntent
  readonly observation: LifecycleObservation
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

  if (intent.kind === 'uninstall') {
    if (observation.kind === 'absent') {
      return observation.drift.kind === 'recorded-absent' ? 'clear-ghost' : 'preserve-unmanaged'
    }
    return observation.providerId && input.providerTargetId ? 'uninstall' : 'preserve-unmanaged'
  }

  if (observation.kind === 'present') {
    if (observation.drift.kind === 'untracked') {
      return observation.providerId ? 'adopt' : 'preserve-unmanaged'
    }
    return 'satisfied'
  }

  return input.providerId && input.providerTargetId ? 'install' : 'blocked'
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
      return []
  }
}

function providerMutationStep(
  operation: 'install' | 'uninstall',
  input: LifecycleMutationPlanningInput,
  postcondition: LifecyclePostcondition,
): LifecycleStep {
  const providerId =
    input.observation.kind === 'present' ? (input.observation.providerId ?? input.providerId) : input.providerId
  const providerTargetId = input.providerTargetId!

  return {
    dependsOn: [],
    effects: [
      {
        capability: `${providerId}-${operation}`,
        kind: 'provider-mutation',
        providerId,
        targetId: providerTargetId,
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
    providerId:
      input.observation.kind === 'present' ? (input.observation.providerId ?? input.providerId!) : input.providerId!,
    targetId: input.providerTargetId!,
  }
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
