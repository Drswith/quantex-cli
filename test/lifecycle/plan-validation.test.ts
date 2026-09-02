import { describe, expect, it } from 'vitest'
import {
  type LifecycleEffect,
  type LifecycleOutcome,
  type LifecyclePlan,
  type LifecyclePostcondition,
  type LifecycleStep,
  type ProviderCapability,
  validateLifecyclePlan,
} from '../../src/lifecycle'

const providerCapabilities = [
  'package-observe',
  'package-install',
  'package-uninstall',
  'postcondition-verify',
] as const satisfies readonly ProviderCapability[]

describe('validateLifecyclePlan', () => {
  it('accepts an ordered plan with declared capabilities, postconditions, and compensation', () => {
    const plan = createPlan([
      operationStep('observe', {
        effects: [{ kind: 'provider-observation', capability: 'package-observe' }],
      }),
      operationStep('install', {
        dependsOn: ['observe'],
        effects: [{ kind: 'provider-mutation', capability: 'package-install' }],
        postconditions: [packagePresent],
      }),
      operationStep('verify', {
        dependsOn: ['install'],
        effects: [{ kind: 'provider-observation', capability: 'postcondition-verify' }],
      }),
      compensationStep('rollback-install', 'install', {
        dependsOn: ['install'],
        effects: [{ kind: 'provider-mutation', capability: 'package-uninstall' }],
        postconditions: [packageAbsent],
      }),
    ])

    expect(validateLifecyclePlan(plan, providerCapabilities)).toEqual([])
  })

  it('reports each repeated step ID at the repeated step', () => {
    const plan = createPlan([operationStep('observe'), operationStep('observe'), operationStep('observe')])

    expect(validateLifecyclePlan(plan, providerCapabilities)).toEqual([
      { code: 'DUPLICATE_STEP_ID', stepId: 'observe' },
      { code: 'DUPLICATE_STEP_ID', stepId: 'observe' },
    ])
  })

  it('reports missing and forward dependencies in step order', () => {
    const plan = createPlan([
      operationStep('prepare', { dependsOn: ['missing'] }),
      operationStep('install', { dependsOn: ['verify'] }),
      operationStep('verify'),
    ])

    expect(validateLifecyclePlan(plan, providerCapabilities)).toEqual([
      { code: 'MISSING_DEPENDENCY', stepId: 'prepare', value: 'missing' },
      { code: 'FORWARD_DEPENDENCY', stepId: 'install', value: 'verify' },
    ])
  })

  it('reports undeclared provider effects before a missing mutation postcondition', () => {
    const plan = createPlan([
      operationStep('install', {
        effects: [{ kind: 'provider-mutation', capability: 'package-install' }],
      }),
    ])

    expect(validateLifecyclePlan(plan, ['package-observe'])).toEqual([
      { code: 'MISSING_CAPABILITY', stepId: 'install', value: 'package-install' },
      { code: 'MISSING_POSTCONDITION', stepId: 'install' },
    ])
  })

  it('reports unresolved and forward compensation references in step order', () => {
    const plan = createPlan([
      compensationStep('rollback-missing', 'missing', {
        effects: [{ kind: 'provider-mutation', capability: 'package-uninstall' }],
        postconditions: [packageAbsent],
      }),
      compensationStep('rollback-forward', 'install', {
        effects: [{ kind: 'provider-mutation', capability: 'package-uninstall' }],
        postconditions: [packageAbsent],
      }),
      operationStep('install', {
        effects: [{ kind: 'provider-mutation', capability: 'package-install' }],
        postconditions: [packagePresent],
      }),
    ])

    expect(validateLifecyclePlan(plan, providerCapabilities)).toEqual([
      { code: 'MISSING_COMPENSATED_STEP', stepId: 'rollback-missing', value: 'missing' },
      { code: 'FORWARD_COMPENSATED_STEP', stepId: 'rollback-forward', value: 'install' },
    ])
  })

  it('reports compensation steps with missing or empty targets in step order', () => {
    const plan = createPlan([
      {
        dependsOn: [],
        effects: [],
        id: 'rollback-missing-target',
        kind: 'compensation',
        postconditions: [],
        preconditions: [],
      } as unknown as LifecycleStep,
      {
        compensatesStepId: '',
        dependsOn: [],
        effects: [],
        id: 'rollback-empty-target',
        kind: 'compensation',
        postconditions: [],
        preconditions: [],
      } as unknown as LifecycleStep,
    ])

    expect(validateLifecyclePlan(plan, providerCapabilities)).toEqual([
      { code: 'MISSING_COMPENSATION_TARGET', stepId: 'rollback-missing-target' },
      { code: 'MISSING_COMPENSATION_TARGET', stepId: 'rollback-empty-target' },
    ])
  })

  it('reports operations carrying unexpected compensation targets', () => {
    const plan = createPlan([
      {
        ...operationStep('install'),
        compensatesStepId: 'prepare',
      } as unknown as LifecycleStep,
    ])

    expect(validateLifecyclePlan(plan, providerCapabilities)).toEqual([
      { code: 'UNEXPECTED_COMPENSATION_TARGET', stepId: 'install' },
    ])
  })
})

describe('LifecycleOutcome', () => {
  it('keeps lifecycle completion states structurally distinct from CLI errors', () => {
    const outcomes: readonly LifecycleOutcome<string>[] = [
      { kind: 'success', value: 'installed' },
      { kind: 'unsupported', capability: 'package-install' },
      { kind: 'failed', reason: 'provider-failed', retryable: false },
      { kind: 'cancelled' },
      { kind: 'timed-out', timeoutMs: 1_000 },
      { kind: 'indeterminate', reason: 'observation-incomplete' },
    ]

    expect(outcomes.map(outcome => outcome.kind)).toEqual([
      'success',
      'unsupported',
      'failed',
      'cancelled',
      'timed-out',
      'indeterminate',
    ])
  })
})

const packagePresent: LifecyclePostcondition = {
  kind: 'package-present',
  providerId: 'npm',
  targetId: '@openai/codex',
}

const packageAbsent: LifecyclePostcondition = {
  kind: 'package-absent',
  providerId: 'npm',
  targetId: '@openai/codex',
}

interface StepInput {
  readonly dependsOn?: readonly string[]
  readonly effects?: readonly LifecycleEffect[]
  readonly postconditions?: readonly LifecyclePostcondition[]
  readonly preconditions?: readonly LifecyclePostcondition[]
}

function createPlan(steps: readonly LifecycleStep[]): LifecyclePlan {
  return {
    id: 'install-codex',
    intent: { kind: 'install', targetId: 'codex' },
    kind: 'lifecycle-plan',
    observation: {
      drift: { kind: 'none' },
      kind: 'absent',
      targetId: 'codex',
    },
    steps,
  }
}

function operationStep(id: string, input: StepInput = {}): LifecycleStep {
  return {
    dependsOn: input.dependsOn ?? [],
    effects: input.effects ?? [],
    id,
    kind: 'operation',
    postconditions: input.postconditions ?? [],
    preconditions: input.preconditions ?? [],
  }
}

function compensationStep(id: string, compensatesStepId: string, input: StepInput = {}): LifecycleStep {
  return {
    compensatesStepId,
    dependsOn: input.dependsOn ?? [],
    effects: input.effects ?? [],
    id,
    kind: 'compensation',
    postconditions: input.postconditions ?? [],
    preconditions: input.preconditions ?? [],
  }
}
