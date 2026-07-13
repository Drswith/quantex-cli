import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { LifecycleObservation } from '../../src/lifecycle'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import type { InstalledAgentState } from '../../src/state'
import { describe, expect, it } from 'vitest'
import { projectObservationToV1Inspection } from '../../src/compatibility/agent-inspection'

const agent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  name: 'test-agent',
  packages: { npm: 'test-package' },
  platforms: { linux: [{ packageName: 'test-package', type: 'bun' }] },
}
const methods: InstallMethod[] = [{ packageName: 'test-package', type: 'bun' }]
const trackedState: InstalledAgentState = {
  agentName: 'test-agent',
  installType: 'bun',
  packageName: 'test-package',
}

describe('v1 agent inspection projection', () => {
  it('keeps a tracked provider-present PATH-absent conflict absent in v1', () => {
    const result = Object.assign(resolved(present({ kind: 'conflicting-source' }), trackedState), {
      pathExecutable: { present: false },
    })

    expect(projectObservationToV1Inspection(result)).toMatchObject({
      binaryPath: undefined,
      inPath: false,
      installedVersion: undefined,
      resolvedBinaryPath: undefined,
    })
  })

  it.each([
    {
      expected: {
        binaryPath: '/usr/local/bin/test-bin',
        inPath: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'managed',
        resolvedBinaryPath: '/opt/test/bin/test-bin',
        sourceLabel: 'managed via bun (test-package)',
        updateLabel: 'managed update',
      },
      name: 'tracked',
      result: resolved(present({ kind: 'none' }), trackedState),
    },
    {
      expected: {
        binaryPath: '/usr/local/bin/test-bin',
        inPath: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'unmanaged',
        resolvedBinaryPath: '/opt/test/bin/test-bin',
        sourceLabel: 'detected in PATH',
        updateLabel: 'manual update',
      },
      name: 'untracked',
      result: resolved(present({ kind: 'untracked' })),
    },
    {
      expected: {
        inPath: false,
        latestVersion: '2.0.0',
        lifecycle: 'managed',
        sourceLabel: 'managed via bun (test-package)',
        updateLabel: 'managed update',
      },
      name: 'ghost',
      result: resolved(absent({ kind: 'recorded-absent' }), trackedState, { present: false }),
    },
    {
      expected: {
        binaryPath: '/usr/local/bin/test-bin',
        inPath: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'managed',
        resolvedBinaryPath: '/opt/test/bin/test-bin',
        sourceLabel: 'managed via bun (test-package)',
        updateLabel: 'managed update',
      },
      name: 'conflicting',
      result: resolved(present({ kind: 'conflicting-source' }), trackedState),
    },
    {
      expected: {
        binaryPath: '/usr/local/bin/test-bin',
        inPath: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'unmanaged',
        resolvedBinaryPath: '/opt/test/bin/test-bin',
        sourceLabel: 'detected in PATH',
        updateLabel: 'manual update',
      },
      name: 'indeterminate',
      result: resolved(indeterminate(), undefined),
    },
  ])('preserves historical inspection meanings for $name observations', ({ expected, result }) => {
    const inspection = projectObservationToV1Inspection(result)

    expect(inspection).toEqual({ agent, methods, ...expected, installedState: result.installedState })
    expect(Object.keys(inspection).sort()).toEqual(
      [
        'agent',
        'binaryPath',
        'inPath',
        'installedState',
        'installedVersion',
        'latestVersion',
        'lifecycle',
        'methods',
        'resolvedBinaryPath',
        'sourceLabel',
        'updateLabel',
      ].sort(),
    )
    expect(inspection).not.toHaveProperty('observation')
    expect(inspection).not.toHaveProperty('drift')
    expect(inspection).not.toHaveProperty('receipt')
    expect(inspection).not.toHaveProperty('binding')
    expect(inspection).not.toHaveProperty('capabilities')
  })
})

function resolved(
  observation: LifecycleObservation,
  installedState?: InstalledAgentState,
  executable: ResolvedAgentObservation['executable'] = {
    path: '/usr/local/bin/test-bin',
    present: true,
    version: '1.2.3',
  },
): ResolvedAgentObservation {
  return {
    agent,
    capabilities: ['observe', 'update'],
    catalogMethods: [],
    executable,
    installedState,
    latestVersion: '2.0.0',
    methods,
    observation,
    pathExecutable: executable,
    receipt: installedState
      ? {
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: 'test-package',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'test-agent',
          verifiedAt: '2026-07-12T08:00:00.000Z',
        }
      : undefined,
    resolvedBinaryPath: executable.path ? '/opt/test/bin/test-bin' : undefined,
  }
}

function present(drift: LifecycleObservation['drift']): LifecycleObservation {
  return {
    drift,
    executablePath: '/usr/local/bin/test-bin',
    kind: 'present',
    observedAt: '2026-07-12T08:00:00.000Z',
    targetId: 'test-agent',
    version: '1.2.3',
  }
}

function absent(drift: LifecycleObservation['drift']): LifecycleObservation {
  return {
    drift,
    kind: 'absent',
    observedAt: '2026-07-12T08:00:00.000Z',
    targetId: 'test-agent',
  }
}

function indeterminate(): LifecycleObservation {
  return {
    drift: { kind: 'indeterminate', reason: 'provider unavailable' },
    kind: 'indeterminate',
    observedAt: '2026-07-12T08:00:00.000Z',
    reason: 'provider unavailable',
    targetId: 'test-agent',
  }
}
