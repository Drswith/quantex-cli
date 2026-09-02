import type { LifecyclePlan, ProviderCapability } from './model'

export type PlanValidationIssueCode =
  | 'DUPLICATE_STEP_ID'
  | 'MISSING_DEPENDENCY'
  | 'FORWARD_DEPENDENCY'
  | 'MISSING_CAPABILITY'
  | 'MISSING_POSTCONDITION'
  | 'MISSING_COMPENSATION_TARGET'
  | 'UNEXPECTED_COMPENSATION_TARGET'
  | 'MISSING_COMPENSATED_STEP'
  | 'FORWARD_COMPENSATED_STEP'

export type PlanValidationIssue =
  | {
      readonly code:
        | 'DUPLICATE_STEP_ID'
        | 'MISSING_POSTCONDITION'
        | 'MISSING_COMPENSATION_TARGET'
        | 'UNEXPECTED_COMPENSATION_TARGET'
      readonly stepId: string
    }
  | {
      readonly code: Exclude<
        PlanValidationIssueCode,
        'DUPLICATE_STEP_ID' | 'MISSING_POSTCONDITION' | 'MISSING_COMPENSATION_TARGET' | 'UNEXPECTED_COMPENSATION_TARGET'
      >
      readonly stepId: string
      readonly value: string
    }

export function validateLifecyclePlan(
  plan: LifecyclePlan,
  capabilities: readonly ProviderCapability[],
): readonly PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = []
  const capabilitySet = new Set(capabilities)
  const firstStepIndex = new Map<string, number>()

  for (const [stepIndex, step] of plan.steps.entries()) {
    if (!firstStepIndex.has(step.id)) {
      firstStepIndex.set(step.id, stepIndex)
    }
  }

  const seenStepIds = new Set<string>()

  for (const [stepIndex, step] of plan.steps.entries()) {
    if (seenStepIds.has(step.id)) {
      issues.push({ code: 'DUPLICATE_STEP_ID', stepId: step.id })
    } else {
      seenStepIds.add(step.id)
    }

    for (const dependencyId of step.dependsOn) {
      const dependencyIndex = firstStepIndex.get(dependencyId)

      if (dependencyIndex === undefined) {
        issues.push({ code: 'MISSING_DEPENDENCY', stepId: step.id, value: dependencyId })
      } else if (dependencyIndex >= stepIndex) {
        issues.push({ code: 'FORWARD_DEPENDENCY', stepId: step.id, value: dependencyId })
      }
    }

    for (const effect of step.effects) {
      if (!capabilitySet.has(effect.capability)) {
        issues.push({ code: 'MISSING_CAPABILITY', stepId: step.id, value: effect.capability })
      }
    }

    const hasMutation = step.effects.some(effect => effect.kind === 'provider-mutation')
    if (hasMutation && step.postconditions.length === 0) {
      issues.push({ code: 'MISSING_POSTCONDITION', stepId: step.id })
    }

    const compensationTarget: unknown = step.compensatesStepId

    if (step.kind === 'compensation') {
      if (typeof compensationTarget !== 'string' || compensationTarget.length === 0) {
        issues.push({ code: 'MISSING_COMPENSATION_TARGET', stepId: step.id })
        continue
      }

      const compensatedStepIndex = firstStepIndex.get(compensationTarget)

      if (compensatedStepIndex === undefined) {
        issues.push({
          code: 'MISSING_COMPENSATED_STEP',
          stepId: step.id,
          value: compensationTarget,
        })
      } else if (compensatedStepIndex >= stepIndex) {
        issues.push({
          code: 'FORWARD_COMPENSATED_STEP',
          stepId: step.id,
          value: compensationTarget,
        })
      }
    } else if (compensationTarget !== undefined) {
      issues.push({ code: 'UNEXPECTED_COMPENSATION_TARGET', stepId: step.id })
    }
  }

  return issues
}
