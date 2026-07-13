import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { LifecycleObservation } from '../../src/lifecycle'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import type { InstalledAgentState } from '../../src/state'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { resolveCommand } from '../../src/commands/resolve'
import * as legacyAgentsService from '../../src/services/agents'
import * as lifecycleObservations from '../../src/services/lifecycle-observations'

const resolveAgentInspectionSpy = vi.spyOn(legacyAgentsService, 'resolveAgentInspection')
const resolveAgentObservationSpy = vi.spyOn(lifecycleObservations, 'resolveAgentObservation')

const testAgent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  lookupAliases: ['ta'],
  name: 'test-agent',
  packages: { npm: 'test-pkg' },
  platforms: { linux: [{ packageName: 'test-pkg', type: 'bun' }] },
}
const trackedState: InstalledAgentState = {
  agentName: 'test-agent',
  installType: 'bun',
  packageName: 'test-pkg',
}

afterAll(() => {
  resolveAgentInspectionSpy.mockRestore()
  resolveAgentObservationSpy.mockRestore()
})

describe('resolveCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setCliContext({ colorMode: 'never', interactive: false, outputMode: 'human', runId: 'resolve-test' })
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    resolveAgentInspectionSpy.mockReset()
    resolveAgentInspectionSpy.mockRejectedValue(new Error('legacy resolve inspection must not run'))
    resolveAgentObservationSpy.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('resolves an alias through observation and preserves managed source, version, and launch argv', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(observed(present({ kind: 'none' }), trackedState))

    const result = await resolveCommand('ta')

    expect(resolveAgentObservationSpy).toHaveBeenCalledWith('ta')
    expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      action: 'resolve',
      data: {
        agent: { binaryName: 'test-bin', displayName: 'Test Agent', name: 'test-agent' },
        resolution: {
          binaryPath: '/usr/bin/test-bin',
          installed: true,
          installSource: 'bun',
          installedVersion: '1.2.3',
          lifecycle: 'managed',
          sourceLabel: 'managed via bun (test-pkg)',
          suggestedLaunchCommand: ['/usr/bin/test-bin'],
        },
      },
      error: null,
      ok: true,
      target: { kind: 'agent', name: 'test-agent' },
    })
    expectNoInternalObservationFields(result.data)
    expect(logSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      '\nTest Agent\n',
      '  Name:         test-agent',
      '  Binary:       test-bin',
      '  Path:         /usr/bin/test-bin',
      '  Source:       managed via bun (test-pkg)',
      '  Lifecycle:    managed',
      '  Install Type: bun',
      '  Version:      1.2.3',
      '  Launch:       /usr/bin/test-bin',
      undefined,
    ])
  })

  it('preserves untracked PATH resolution semantics', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(observed(present({ kind: 'untracked' })))

    const result = await resolveCommand('test-agent')

    expect(result.data?.resolution).toEqual({
      binaryPath: '/usr/bin/test-bin',
      installed: true,
      installSource: 'detected-in-path',
      installedVersion: '1.2.3',
      lifecycle: 'unmanaged',
      sourceLabel: 'detected in PATH',
      suggestedLaunchCommand: ['/usr/bin/test-bin'],
    })
  })

  it.each([
    ['absent', absent({ kind: 'none' }), undefined],
    ['ghost', absent({ kind: 'recorded-absent' }), trackedState],
    ['conflicting', absent({ kind: 'conflicting-source' }), trackedState],
    ['indeterminate', indeterminate(), trackedState],
  ] as const)(
    'returns unchanged install guidance for %s evidence without PATH presence',
    async (_name, observation, state) => {
      resolveAgentObservationSpy.mockResolvedValueOnce(observed(observation, state, { present: false }))

      const result = await resolveCommand('test-agent')

      const installGuidance = {
        docsRef: 'skills/quantex-cli/references/command-recipes.md',
        installMethods: [{ command: 'bun add -g test-pkg', label: 'managed/bun (test-pkg)', type: 'bun' }],
        suggestedAction: 'ensure-agent-installed',
        suggestedEnsureCommand: 'quantex ensure test-agent',
      }
      expect(result).toMatchObject({
        action: 'resolve',
        data: {
          agent: { binaryName: 'test-bin', displayName: 'Test Agent', name: 'test-agent' },
          resolution: {
            binaryPath: '',
            installGuidance,
            installed: false,
            installSource: 'not-installed',
            lifecycle: 'unmanaged',
            sourceLabel: 'not installed',
            suggestedLaunchCommand: [],
          },
        },
        error: {
          code: 'AGENT_NOT_INSTALLED',
          details: installGuidance,
          message: 'Test Agent is not installed.',
        },
        ok: false,
        target: { kind: 'agent', name: 'test-agent' },
      })
      expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
      expectNoInternalObservationFields(result.data)
      expect(logSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual([
        'Test Agent is not installed.',
        'Try: quantex ensure test-agent',
        'Install: [managed/bun (test-pkg)] bun add -g test-pkg',
      ])
    },
  )

  it('preserves the v1 unknown-agent error', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(undefined)

    const result = await resolveCommand('unknown')

    expect(result).toMatchObject({
      action: 'resolve',
      data: undefined,
      error: { code: 'AGENT_NOT_FOUND', details: { input: 'unknown' }, message: 'Unknown agent: unknown' },
      ok: false,
      target: { kind: 'agent', name: 'unknown' },
    })
    expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    expect(logSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual(['Unknown agent: unknown'])
  })
})

function observed(
  observation: LifecycleObservation,
  installedState?: InstalledAgentState,
  pathExecutable: ResolvedAgentObservation['pathExecutable'] = {
    path: '/usr/bin/test-bin',
    present: true,
    version: '1.2.3',
  },
): ResolvedAgentObservation {
  const methods: InstallMethod[] = [{ packageName: 'test-pkg', type: 'bun' }]
  return {
    agent: testAgent,
    capabilities: ['observe', 'update'],
    catalogMethods: [],
    executable: pathExecutable,
    installedState,
    latestVersion: '2.0.0',
    methods,
    observation,
    pathExecutable,
    receipt: installedState
      ? {
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: 'test-pkg',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'test-agent',
          verifiedAt: '2026-07-12T08:00:00.000Z',
        }
      : undefined,
    resolvedBinaryPath: pathExecutable.path,
  }
}

function present(drift: LifecycleObservation['drift']): LifecycleObservation {
  return {
    drift,
    executablePath: '/usr/bin/test-bin',
    kind: 'present',
    targetId: 'test-agent',
    version: '1.2.3',
  }
}

function absent(drift: LifecycleObservation['drift']): LifecycleObservation {
  return { drift, kind: 'absent', targetId: 'test-agent' }
}

function indeterminate(): LifecycleObservation {
  return {
    drift: { kind: 'indeterminate', reason: 'provider unavailable' },
    kind: 'indeterminate',
    reason: 'provider unavailable',
    targetId: 'test-agent',
  }
}

function expectNoInternalObservationFields(value: unknown): void {
  expect(JSON.stringify(value)).not.toMatch(
    /"(?:binding|capabilities|drift|providerTarget|providerTargetId|providerTargetKind|receipt)"/,
  )
}
