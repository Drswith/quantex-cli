import type { LifecycleIntent, LifecycleObservation } from '../../src/lifecycle'
import { describe, expect, it } from 'vitest'
import { planLifecycleMutation } from '../../src/lifecycle/mutation-planner'

describe('planLifecycleMutation', () => {
  it.each([
    ['already-satisfied', intent('ensure'), present({ drift: { kind: 'none' }, providerId: 'bun' }), 'satisfied'],
    ['adoptable', intent('ensure'), present({ drift: { kind: 'untracked' }, providerId: 'bun' }), 'adopt'],
    ['unmanaged', intent('install'), present({ drift: { kind: 'untracked' } }), 'preserve-unmanaged'],
    ['absent', intent('install'), absent(), 'install'],
    ['ghost', intent('uninstall'), absent({ drift: { kind: 'recorded-absent' } }), 'clear-ghost'],
    ['managed', intent('uninstall'), present({ drift: { kind: 'none' }, providerId: 'bun' }), 'uninstall'],
    ['indeterminate', intent('ensure'), indeterminate(), 'blocked'],
  ] as const)('plans the %s observation deterministically', (_name, lifecycleIntent, observation, decision) => {
    const first = planLifecycleMutation({
      intent: lifecycleIntent,
      observation,
      providerId: 'bun',
      providerTargetId: '@openai/codex',
    })
    const second = planLifecycleMutation({
      intent: lifecycleIntent,
      observation,
      providerId: 'bun',
      providerTargetId: '@openai/codex',
    })

    expect(first).toEqual(second)
    expect(first.decision).toBe(decision)
  })

  it('declares provider mutation effects and verified postconditions for install', () => {
    const result = planLifecycleMutation({
      intent: intent('install'),
      observation: absent(),
      providerId: 'bun',
      providerTargetId: '@openai/codex',
    })

    expect(result.plan.steps).toEqual([
      expect.objectContaining({
        effects: [
          {
            capability: 'bun-install',
            kind: 'provider-mutation',
            providerId: 'bun',
            targetId: '@openai/codex',
          },
        ],
        id: 'install-codex',
        postconditions: [
          {
            kind: 'package-present',
            providerId: 'bun',
            targetId: '@openai/codex',
          },
        ],
      }),
    ])
  })
})

function intent(kind: LifecycleIntent['kind']): LifecycleIntent {
  return { kind, targetId: 'codex' }
}

function present(input: Partial<Extract<LifecycleObservation, { kind: 'present' }>> = {}): LifecycleObservation {
  return {
    drift: input.drift ?? { kind: 'none' },
    kind: 'present',
    targetId: 'codex',
    ...input,
  }
}

function absent(input: Partial<Extract<LifecycleObservation, { kind: 'absent' }>> = {}): LifecycleObservation {
  return {
    drift: input.drift ?? { kind: 'none' },
    kind: 'absent',
    targetId: 'codex',
    ...input,
  }
}

function indeterminate(): LifecycleObservation {
  return {
    drift: { kind: 'indeterminate', reason: 'provider-timeout' },
    kind: 'indeterminate',
    reason: 'provider-timeout',
    targetId: 'codex',
  }
}
