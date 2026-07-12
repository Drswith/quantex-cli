import { describe, expect, it } from 'vitest'
import { compareShadowMutationDecision, shadowPlanLifecycleMutation } from '../../src/lifecycle/shadow-planning'

describe('compareShadowMutationDecision', () => {
  it('reports a match without changing the selected legacy decision', () => {
    expect(
      compareShadowMutationDecision({
        legacyDecision: 'install',
        plannedDecision: 'install',
        targetId: 'codex',
      }),
    ).toEqual({ kind: 'match', selectedDecision: 'install', targetId: 'codex' })
  })

  it('reports a structured mismatch while retaining legacy routing', () => {
    expect(
      compareShadowMutationDecision({
        legacyDecision: 'uninstall',
        plannedDecision: 'clear-ghost',
        targetId: 'codex',
      }),
    ).toEqual({
      kind: 'mismatch',
      legacyDecision: 'uninstall',
      plannedDecision: 'clear-ghost',
      selectedDecision: 'uninstall',
      targetId: 'codex',
    })
  })
})

describe('shadowPlanLifecycleMutation', () => {
  it.each([
    ['ensure tracked present', 'ensure', 'satisfied', 'none'],
    ['install adoptable present', 'install', 'adopt', 'untracked'],
    ['install unmanaged present', 'install', 'preserve-unmanaged', 'untracked'],
    ['install absent', 'install', 'install', 'absent'],
    ['uninstall tracked present', 'uninstall', 'uninstall', 'none'],
    ['uninstall untracked present', 'uninstall', 'preserve-unmanaged', 'untracked'],
  ] as const)('matches the current %s decision without selecting a new route', (_name, kind, legacyDecision, state) => {
    const present = state !== 'absent'
    const managedEvidence = legacyDecision !== 'preserve-unmanaged'
    const result = shadowPlanLifecycleMutation({
      intent: { kind, targetId: 'codex' },
      legacyDecision,
      observation: present
        ? {
            drift: { kind: state },
            kind: 'present',
            providerId: managedEvidence ? 'bun' : undefined,
            targetId: 'codex',
          }
        : {
            drift: { kind: 'none' },
            kind: 'absent',
            targetId: 'codex',
          },
      providerId: 'bun',
      providerTargetId: '@openai/codex',
    })

    expect(result.comparison).toMatchObject({
      kind: 'match',
      selectedDecision: legacyDecision,
    })
    expect(result.plan.intent.kind).toBe(kind)
  })

  it('surfaces a ghost-state mismatch without changing legacy uninstall routing', () => {
    const result = shadowPlanLifecycleMutation({
      intent: { kind: 'uninstall', targetId: 'codex' },
      legacyDecision: 'uninstall',
      observation: {
        drift: { kind: 'recorded-absent' },
        kind: 'absent',
        targetId: 'codex',
      },
      providerId: 'bun',
      providerTargetId: '@openai/codex',
    })

    expect(result.comparison).toEqual({
      kind: 'mismatch',
      legacyDecision: 'uninstall',
      plannedDecision: 'clear-ghost',
      selectedDecision: 'uninstall',
      targetId: 'codex',
    })
  })
})
