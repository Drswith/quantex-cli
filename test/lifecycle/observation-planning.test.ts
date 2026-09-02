import type { LifecycleIntent, LifecycleObservation, LifecycleStep } from '../../src/lifecycle'
import { describe, expect, it } from 'vitest'
import { planLifecycleMutation } from '../../src/lifecycle/mutation-planner'

describe('observation-driven lifecycle planning', () => {
  it.each([
    {
      capabilities: ['install', 'uninstall'],
      decision: 'satisfied',
      intent: intent('ensure'),
      name: 'already-satisfied',
      observation: present({ drift: { kind: 'none' }, providerId: 'bun', providerTargetId: packageId }),
      steps: [],
    },
    {
      capabilities: ['install'],
      decision: 'install',
      intent: intent('install'),
      name: 'absent',
      observation: absent(),
      steps: [providerStep('install', 'package-present')],
    },
    {
      capabilities: ['uninstall'],
      decision: 'uninstall',
      intent: intent('uninstall'),
      name: 'tracked',
      observation: present({ drift: { kind: 'none' }, providerId: 'bun', providerTargetId: packageId }),
      steps: [providerStep('uninstall', 'package-absent')],
    },
    {
      capabilities: [],
      decision: 'adopt',
      intent: intent('ensure'),
      name: 'untracked with exact provider evidence',
      observation: present({
        drift: { kind: 'untracked' },
        executablePath: '/opt/homebrew/bin/codex',
        providerId: 'bun',
        providerTargetId: packageId,
      }),
      steps: [
        {
          dependsOn: [],
          effects: [],
          id: 'adopt-codex',
          kind: 'operation',
          postconditions: [{ executable: '/opt/homebrew/bin/codex', kind: 'executable-present' }],
          preconditions: [],
        },
      ],
    },
    {
      capabilities: ['uninstall'],
      decision: 'clear-ghost',
      intent: intent('uninstall'),
      name: 'ghost',
      observation: absent({ drift: { kind: 'recorded-absent' } }),
      steps: [emptyStep('clear-ghost-codex')],
    },
    {
      capabilities: ['install', 'uninstall'],
      decision: 'blocked',
      intent: intent('ensure'),
      name: 'conflicting',
      observation: present({ drift: { kind: 'conflicting-source' } }),
      steps: [],
    },
    {
      capabilities: [],
      decision: 'unsupported',
      intent: intent('install'),
      name: 'unsupported',
      observation: absent(),
      steps: [],
    },
    {
      capabilities: ['install'],
      decision: 'blocked',
      intent: intent('ensure'),
      name: 'indeterminate',
      observation: indeterminate(),
      steps: [],
    },
    {
      capabilities: [],
      decision: 'preserve-unmanaged',
      intent: intent('uninstall'),
      name: 'untracked without provider evidence',
      observation: present({ drift: { kind: 'untracked' } }),
      steps: [],
    },
  ] as const)(
    'produces a stable $name decision, id, step order, effects, and postconditions',
    ({ capabilities, decision, intent: lifecycleIntent, observation, steps }) => {
      const input = {
        intent: lifecycleIntent,
        observation,
        provider: { capabilities, providerId: 'bun', targetId: packageId, targetKind: 'package' as const },
      }

      const first = planLifecycleMutation(input)
      const second = planLifecycleMutation(input)

      expect(first).toEqual(second)
      expect(first).toEqual({
        decision,
        plan: {
          id: `${lifecycleIntent.kind}-codex`,
          intent: lifecycleIntent,
          kind: 'lifecycle-plan',
          observation,
          steps,
        },
      })
    },
  )
})

const packageId = '@openai/codex'

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

function providerStep(
  operation: 'install' | 'uninstall',
  postcondition: 'package-absent' | 'package-present',
): LifecycleStep {
  return {
    dependsOn: [],
    effects: [
      {
        capability: `bun-${operation}`,
        kind: 'provider-mutation',
        providerId: 'bun',
        targetId: packageId,
      },
    ],
    id: `${operation}-codex`,
    kind: 'operation',
    postconditions: [{ kind: postcondition, providerId: 'bun', targetId: packageId }],
    preconditions: [],
  }
}

function emptyStep(id: string): LifecycleStep {
  return {
    dependsOn: [],
    effects: [],
    id,
    kind: 'operation',
    postconditions: [],
    preconditions: [],
  }
}
