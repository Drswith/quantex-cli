import type { LifecycleIntent, LifecycleObservation } from '../../src/lifecycle'
import type { LifecyclePlanningProvider } from '../../src/lifecycle/model'
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

  it('returns unsupported instead of inventing a missing provider mutation capability', () => {
    const result = planLifecycleMutation({
      intent: intent('install'),
      observation: absent(),
      provider: { capabilities: [], providerId: 'bun', targetId: '@openai/codex', targetKind: 'package' },
    })

    expect(result).toMatchObject({
      decision: 'unsupported',
      plan: { id: 'install-codex', steps: [] },
    })
  })

  it('returns unsupported when tracked uninstall lacks the provider capability', () => {
    const result = planLifecycleMutation({
      intent: intent('uninstall'),
      observation: present({
        drift: { kind: 'none' },
        providerId: 'bun',
        providerTargetId: '@openai/codex',
      }),
      provider: {
        capabilities: ['observe'],
        providerId: 'bun',
        targetId: '@openai/codex',
        targetKind: 'package',
      },
    })

    expect(result).toMatchObject({
      decision: 'unsupported',
      plan: { id: 'uninstall-codex', steps: [] },
    })
  })

  it.each([
    present({
      drift: { kind: 'conflicting-source', observedProviderId: 'npm', recordedProviderId: 'bun' },
      providerId: 'npm',
      providerTargetId: '@openai/codex',
    }),
    indeterminate(),
  ])('blocks contradictory or incomplete observations without planning effects', observation => {
    const result = planLifecycleMutation({
      intent: intent('install'),
      observation,
      provider: {
        capabilities: ['install'],
        providerId: 'bun',
        targetId: '@openai/codex',
        targetKind: 'package',
      },
    })

    expect(result).toMatchObject({
      decision: 'blocked',
      plan: { id: 'install-codex', steps: [] },
    })
  })

  it('blocks a capability snapshot bound to a different observed provider target', () => {
    const result = planLifecycleMutation({
      intent: intent('uninstall'),
      observation: present({
        drift: { kind: 'none' },
        providerId: 'npm',
        providerTargetId: '@openai/codex',
      }),
      provider: {
        capabilities: ['uninstall'],
        providerId: 'bun',
        targetId: '@openai/codex',
        targetKind: 'package',
      },
    })

    expect(result).toMatchObject({
      decision: 'blocked',
      plan: { id: 'uninstall-codex', steps: [] },
    })
  })

  it('requires target kind on new planning snapshots and blocks malformed runtime input that omits it', () => {
    // @ts-expect-error Exact planning snapshots must include their provider target kind.
    const missingKindProvider: LifecyclePlanningProvider = {
      capabilities: ['uninstall'],
      providerId: 'brew',
      targetId: 'demo',
    }
    const result = planLifecycleMutation({
      intent: intent('uninstall'),
      observation: present({
        drift: { kind: 'none' },
        providerId: 'brew',
        providerTargetId: 'demo',
        providerTargetKind: 'cask',
      }),
      provider: missingKindProvider,
    })

    expect(result).toMatchObject({
      decision: 'blocked',
      plan: { id: 'uninstall-codex', steps: [] },
    })
  })

  it('blocks a planning snapshot with a different provider target kind', () => {
    const result = planLifecycleMutation({
      intent: intent('uninstall'),
      observation: present({
        drift: { kind: 'none' },
        providerId: 'brew',
        providerTargetId: 'demo',
        providerTargetKind: 'cask',
      }),
      provider: {
        capabilities: ['uninstall'],
        providerId: 'brew',
        targetId: 'demo',
        targetKind: 'formula',
      },
    })

    expect(result).toMatchObject({
      decision: 'blocked',
      plan: { id: 'uninstall-codex', steps: [] },
    })
  })

  it('keeps legacy provider fields compatible without requiring a planning target kind', () => {
    const result = planLifecycleMutation({
      intent: intent('uninstall'),
      observation: present({
        drift: { kind: 'none' },
        providerId: 'brew',
        providerTargetId: 'demo',
        providerTargetKind: 'cask',
      }),
      providerId: 'brew',
      providerTargetId: 'demo',
    })

    expect(result.decision).toBe('uninstall')
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
