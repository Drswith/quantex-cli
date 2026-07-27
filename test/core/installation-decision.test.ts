import type { AgentDefinition } from '../../src/agents/types'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { LifecycleObservation } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { ProviderOutcome, ProviderObservation } from '../../src/providers/types'
import { describe, expect, it } from 'vitest'
import { decideCoreInstallation } from '../../src/core/installation-decision'

const agent: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  name: 'fixture-agent',
  packages: { npm: 'fixture-agent' },
  platforms: { linux: [{ type: 'npm' }] },
}

const npmBinding: LifecycleProviderBinding = {
  providerId: 'npm',
  target: { id: 'fixture-agent', kind: 'package' },
}

describe('Core installation decision', () => {
  it('keeps a matching managed installation satisfied', () => {
    const directive = decideCoreInstallation(
      observed(present({ kind: 'none' }), { binding: npmBinding, persistedBinding: npmBinding }),
    )

    expect(directive).toEqual({
      binding: npmBinding,
      changed: false,
      decision: 'already-satisfied',
      kind: 'ready',
    })
  })

  it('preserves PATH-only installations as external without adoption', () => {
    const directive = decideCoreInstallation(observed(present({ kind: 'untracked' }), { binding: npmBinding }))

    expect(directive).toEqual({
      binding: npmBinding,
      changed: false,
      decision: 'external-preserved',
      kind: 'ready',
    })
  })

  it('selects a catalog install only for conclusive missing evidence', () => {
    expect(decideCoreInstallation(observed(absent({ kind: 'none' })))).toEqual({
      decision: 'install',
      kind: 'ready',
      wouldChange: true,
    })
  })

  it('binds stale reinstall to the exact recorded provider source', () => {
    expect(
      decideCoreInstallation(
        observed(absent({ kind: 'recorded-absent' }), {
          binding: npmBinding,
          persistedBinding: npmBinding,
        }),
      ),
    ).toEqual({
      decision: 'reinstall',
      kind: 'ready',
      requiredBinding: npmBinding,
      wouldChange: true,
    })
  })

  it('fails closed for conflict, unknown state, and source-less managed evidence', () => {
    expect(decideCoreInstallation(observed(present({ kind: 'conflicting-source' })))).toMatchObject({
      code: 'conflict',
      kind: 'blocked',
    })
    expect(decideCoreInstallation(observed(indeterminate('provider evidence is unknown')))).toEqual({
      code: 'indeterminate',
      kind: 'blocked',
      reason: 'provider evidence is unknown',
    })
    expect(decideCoreInstallation(observed(present({ kind: 'none' })))).toMatchObject({
      code: 'indeterminate',
      kind: 'blocked',
    })
    expect(decideCoreInstallation(observed(absent({ kind: 'recorded-absent' })))).toMatchObject({
      code: 'indeterminate',
      kind: 'blocked',
    })
  })

  it('preserves typed cancellation and timeout instead of treating them as missing', () => {
    expect(
      decideCoreInstallation(
        observed(indeterminate('cancelled'), {
          providerOutcome: { kind: 'cancelled', reason: 'stop' },
        }),
      ),
    ).toEqual({ kind: 'interrupted', outcome: { kind: 'cancelled', reason: 'stop' } })
    expect(
      decideCoreInstallation(
        observed(indeterminate('timed out'), {
          providerOutcome: { kind: 'timed-out', timeoutMs: 25 },
        }),
      ),
    ).toEqual({ kind: 'interrupted', outcome: { kind: 'timed-out', timeoutMs: 25 } })
  })
})

function observed(
  observation: LifecycleObservation,
  overrides: Partial<CoreAgentObservation> & {
    readonly providerOutcome?: ProviderOutcome<ProviderObservation>
  } = {},
): CoreAgentObservation {
  const executable = {
    path: observation.kind === 'present' ? observation.executablePath : undefined,
    present: observation.kind === 'present',
    version: observation.kind === 'present' ? observation.version : undefined,
  }
  return {
    agent,
    capabilities: [],
    catalogMethods: [npmBinding],
    executable,
    methods: [{ type: 'npm' }],
    observation,
    pathExecutable: executable,
    ...overrides,
  }
}

function present(drift: LifecycleObservation['drift']): Extract<LifecycleObservation, { kind: 'present' }> {
  return {
    drift,
    executablePath: '/tmp/fixture-agent',
    kind: 'present',
    observedAt: '2026-07-22T00:00:00.000Z',
    targetId: agent.name,
    version: '1.0.0',
  }
}

function absent(drift: LifecycleObservation['drift']): Extract<LifecycleObservation, { kind: 'absent' }> {
  return {
    drift,
    kind: 'absent',
    observedAt: '2026-07-22T00:00:00.000Z',
    targetId: agent.name,
  }
}

function indeterminate(reason: string): Extract<LifecycleObservation, { kind: 'indeterminate' }> {
  return {
    drift: { kind: 'indeterminate', reason },
    kind: 'indeterminate',
    observedAt: '2026-07-22T00:00:00.000Z',
    reason,
    targetId: agent.name,
  }
}
