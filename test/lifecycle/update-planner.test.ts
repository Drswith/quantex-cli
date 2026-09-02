import type { AgentInspection } from '../../src/inspection'
import type { LifecycleObservation, LifecyclePlanningProvider } from '../../src/lifecycle'
import { describe, expect, it } from 'vitest'
import { planLifecycleUpdate, projectLifecycleProviderCapabilities, validateLifecyclePlan } from '../../src/lifecycle'
import { createUpdatePlan, isInspectionUpdateAvailable } from '../../src/planning/updates'

describe('planLifecycleUpdate', () => {
  it.each([
    ['semantic downgrade', '2.10.0', '2.9.0', 'blocked-downgrade'],
    ['semantic upgrade', '1.9.0', '1.10.0', 'upgrade'],
    ['prerelease to release', '1.0.0-beta.1', '1.0.0', 'upgrade'],
    ['release to prerelease', '1.0.0', '1.0.0-beta.1', 'blocked-downgrade'],
    ['prerelease identifier ordering', '1.0.0-beta.2', '1.0.0-beta.11', 'upgrade'],
    ['equal versions', '1.0.0', '1.0.0', 'up-to-date'],
    ['missing installed version', undefined, '1.0.0', 'indeterminate'],
    ['missing target version', '1.0.0', undefined, 'indeterminate'],
    ['unparseable installed version', 'main', '1.0.0', 'indeterminate'],
    ['unparseable target version', '1.0.0', 'latest', 'indeterminate'],
  ] as const)('classifies %s without lexical fallback', (_name, installedVersion, targetVersion, decision) => {
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion },
      observation: present({ version: installedVersion }),
      provider: updateProvider(),
    })

    expect(result.decision).toBe(decision)
    if (decision !== 'upgrade') expect(result.plan.steps).toEqual([])
  })

  it('targets the reconciled provider binding and semantic version in the upgrade step', () => {
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({ version: '1.9.0' }),
      provider: updateProvider(),
    })

    expect(result).toEqual({
      decision: 'upgrade',
      plan: {
        id: 'update-codex',
        intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
        kind: 'lifecycle-plan',
        observation: present({ version: '1.9.0' }),
        steps: [
          {
            dependsOn: [],
            effects: [
              {
                capability: 'bun-observe',
                kind: 'provider-observation',
                providerId: 'bun',
                targetId: '@openai/codex',
              },
              {
                capability: 'bun-update',
                kind: 'provider-mutation',
                providerId: 'bun',
                targetId: '@openai/codex',
              },
              {
                capability: 'bun-verify',
                kind: 'provider-observation',
                providerId: 'bun',
                targetId: '@openai/codex',
              },
            ],
            id: 'update-codex',
            kind: 'operation',
            postconditions: [
              {
                expectedVersion: '1.10.0',
                kind: 'version-satisfies',
                targetId: '@openai/codex',
              },
            ],
            preconditions: [],
          },
        ],
      },
    })
  })

  it('blocks conflicting source evidence without choosing another provider', () => {
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({
        drift: { kind: 'conflicting-source', observedProviderId: 'npm', recordedProviderId: 'bun' },
        providerId: 'npm',
        version: '1.9.0',
      }),
      provider: updateProvider(),
    })

    expect(result).toMatchObject({ decision: 'blocked-source', plan: { steps: [] } })
  })

  it('blocks an observation for a different lifecycle target', () => {
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({ targetId: 'claude', version: '1.9.0' }),
      provider: updateProvider(),
    })

    expect(result).toMatchObject({ decision: 'blocked-source', plan: { steps: [] } })
  })

  it.each([
    ['provider ID', { providerId: undefined }],
    ['provider target ID', { providerTargetId: undefined }],
    ['provider target kind', { providerTargetKind: undefined }],
    ['all provider identity', { providerId: undefined, providerTargetId: undefined, providerTargetKind: undefined }],
  ] as const)('blocks a present observation missing %s', (_name, incompleteIdentity) => {
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({ ...incompleteIdentity, drift: { kind: 'untracked' }, version: '1.9.0' }),
      provider: updateProvider(),
    })

    expect(result).toMatchObject({ decision: 'blocked-source', plan: { steps: [] } })
  })

  it('projects provider operations into the exact capabilities declared by a valid plan', () => {
    const provider = updateProvider()
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({ version: '1.9.0' }),
      provider,
    })

    expect(projectLifecycleProviderCapabilities(provider)).toEqual(['bun-observe', 'bun-update', 'bun-verify'])
    expect(validateLifecyclePlan(result.plan, projectLifecycleProviderCapabilities(provider))).toEqual([])
  })

  it.each([
    ['missing update', ['observe', 'verify']],
    ['missing observation', ['update', 'verify']],
    ['missing verification', ['observe', 'update']],
  ] as const)('requires %s capability for automatic updates', (_name, capabilities) => {
    const result = planLifecycleUpdate({
      intent: { kind: 'update', targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({ version: '1.9.0' }),
      provider: updateProvider(capabilities),
    })

    expect(result).toMatchObject({ decision: 'manual-required', plan: { steps: [] } })
  })

  it('is deterministic for repeated equivalent planning inputs', () => {
    const input = {
      intent: { kind: 'update' as const, targetId: 'codex', targetVersion: '1.10.0' },
      observation: present({ version: '1.9.0' }),
      provider: updateProvider(),
    }

    expect(planLifecycleUpdate(input)).toEqual(planLifecycleUpdate(input))
  })
})

describe('legacy update availability projection', () => {
  it.each([
    ['newer semantic target', '1.9.0', '1.10.0', true],
    ['stale lower target', '2.10.0', '2.9.0', false],
    ['unparseable target', '1.0.0', 'latest', false],
    ['missing installed version on the unmigrated v1 route', undefined, '1.10.0', false],
    ['missing target on the unmigrated v1 route', '1.0.0', undefined, false],
  ] as const)('projects %s from the semantic decision', (_name, installedVersion, latestVersion, expected) => {
    expect(isInspectionUpdateAvailable({ installedVersion, latestVersion })).toBe(expected)
  })

  it.each([
    ['unparseable installed version', 'main', '1.0.0'],
    ['unparseable target version', '1.0.0', 'latest'],
  ] as const)('classifies %s as manual instead of up to date', (_name, installedVersion, latestVersion) => {
    const inspection = updateInspection(installedVersion, latestVersion)
    const plan = createUpdatePlan([inspection])

    expect(plan.skippedManualCheck).toEqual([inspection])
    expect(plan.upToDate).toEqual([])
    expect(plan.entries).toEqual([])
  })
})

function updateProvider(capabilities: readonly string[] = ['observe', 'update', 'verify']): LifecyclePlanningProvider {
  return {
    capabilities,
    providerId: 'bun',
    targetId: '@openai/codex',
    targetKind: 'package',
  }
}

function present(input: Partial<Extract<LifecycleObservation, { kind: 'present' }>> = {}): LifecycleObservation {
  return {
    drift: input.drift ?? { kind: 'none' },
    kind: 'present',
    providerId: 'bun',
    providerTargetId: '@openai/codex',
    providerTargetKind: 'package',
    targetId: 'codex',
    ...input,
  }
}

function updateInspection(installedVersion: string, latestVersion: string): AgentInspection {
  return {
    agent: {
      binaryName: 'codex',
      displayName: 'Codex',
      homepage: 'https://example.com',
      name: 'codex',
      platforms: {},
    },
    inPath: true,
    installedVersion,
    latestVersion,
    lifecycle: 'unmanaged',
    methods: [],
    sourceLabel: 'PATH',
    updateLabel: 'manual',
  }
}
