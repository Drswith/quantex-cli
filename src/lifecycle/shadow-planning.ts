import type { LifecyclePlan } from './model'
import {
  type LifecycleMutationDecision,
  type LifecycleMutationPlanningInput,
  planLifecycleMutation,
} from './mutation-planner'

export interface ShadowMutationDecisionInput {
  readonly legacyDecision: LifecycleMutationDecision
  readonly plannedDecision: LifecycleMutationDecision
  readonly targetId: string
}

export type ShadowMutationDecisionComparison =
  | {
      readonly kind: 'match'
      readonly selectedDecision: LifecycleMutationDecision
      readonly targetId: string
    }
  | {
      readonly kind: 'mismatch'
      readonly legacyDecision: LifecycleMutationDecision
      readonly plannedDecision: LifecycleMutationDecision
      readonly selectedDecision: LifecycleMutationDecision
      readonly targetId: string
    }

export interface ShadowLifecycleMutationInput extends LifecycleMutationPlanningInput {
  readonly legacyDecision: LifecycleMutationDecision
}

export interface ShadowLifecycleMutationResult {
  readonly comparison: ShadowMutationDecisionComparison
  readonly plan: LifecyclePlan
}

export function compareShadowMutationDecision(input: ShadowMutationDecisionInput): ShadowMutationDecisionComparison {
  if (input.legacyDecision === input.plannedDecision) {
    return {
      kind: 'match',
      selectedDecision: input.legacyDecision,
      targetId: input.targetId,
    }
  }

  return {
    kind: 'mismatch',
    legacyDecision: input.legacyDecision,
    plannedDecision: input.plannedDecision,
    selectedDecision: input.legacyDecision,
    targetId: input.targetId,
  }
}

export function shadowPlanLifecycleMutation(input: ShadowLifecycleMutationInput): ShadowLifecycleMutationResult {
  const planned = planLifecycleMutation(input)
  return {
    comparison: compareShadowMutationDecision({
      legacyDecision: input.legacyDecision,
      plannedDecision: planned.decision,
      targetId: input.intent.targetId,
    }),
    plan: planned.plan,
  }
}
