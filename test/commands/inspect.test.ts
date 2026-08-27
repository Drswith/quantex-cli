import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { LifecycleObservation } from '../../src/lifecycle'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import type { InstalledAgentState } from '../../src/state'
import process from 'node:process'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { inspectCommand } from '../../src/commands/inspect'
import * as legacyAgentsService from '../../src/services/agents'
import * as coreReadObservations from '../../src/services/core-read-observations'

const resolveAgentInspectionSpy = vi.spyOn(legacyAgentsService, 'resolveAgentInspection')
const resolveAgentObservationSpy = vi.spyOn(coreReadObservations, 'resolveCliReadObservation')

const testAgent: AgentDefinition = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  lookupAliases: ['ta'],
  name: 'test-agent',
  packages: { npm: 'test-pkg' },
  platforms: { linux: [{ packageName: 'test-pkg', type: 'bun' }] },
  selfUpdate: { command: ['test-bin', 'update'] },
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

describe('inspectCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setCliContext({ colorMode: 'never', interactive: false, outputMode: 'human', runId: 'inspect-test' })
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    resolveAgentInspectionSpy.mockReset()
    resolveAgentInspectionSpy.mockRejectedValue(new Error('legacy inspect inspection must not run'))
    resolveAgentObservationSpy.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('routes alias resolution through observation and preserves the exact managed v1 shape', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(observed(present({ kind: 'none' }), trackedState))

    const result = await inspectCommand('ta')

    expect(resolveAgentObservationSpy).toHaveBeenCalledWith('ta')
    expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      action: 'inspect',
      data: {
        agent: {
          aliases: ['ta'],
          binaryName: 'test-bin',
          displayName: 'Test Agent',
          installMethods: [{ command: 'bun add -g test-pkg', label: 'managed/bun (test-pkg)', type: 'bun' }],
          name: 'test-agent',
          packageName: 'test-pkg',
          selfUpdateCommands: ['test-bin update'],
        },
        capabilities: {
          canAutoInstall: true,
          canAutoUninstall: true,
          canRun: true,
          canSelfUpdate: true,
        },
        inspection: {
          binaryPath: '/usr/bin/test-bin',
          installed: true,
          installedVersion: '1.2.3',
          latestVersion: '2.0.0',
          lifecycle: 'managed',
          sourceLabel: 'managed via bun (test-pkg)',
          updateLabel: 'managed update',
        },
      },
      error: null,
      ok: true,
      target: { kind: 'agent', name: 'test-agent' },
    })
    expect(Object.keys(result.data ?? {}).sort()).toEqual(['agent', 'capabilities', 'inspection'])
    expectNoInternalObservationFields(result.data)
    expect(logSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      '\nTest Agent\n',
      '  Name:         test-agent',
      '  Aliases:      ta',
      '  Package:      test-pkg',
      '  Binary:       test-bin',
      '  Installed:    yes',
      '  Update mode:  managed update',
      '  Self update:  test-bin update',
      '  Source:       managed via bun (test-pkg)',
      '  Version:      1.2.3',
      '  Latest:       2.0.0',
      '  Path:         /usr/bin/test-bin',
      '\nCapabilities\n',
      '  Capability      Available',
      '  Auto install    yes',
      '  Self update     yes',
      '  Auto uninstall  yes',
      '  Runnable        yes',
      '\nInstall Methods\n',
      '  Method                  Command',
      '  managed/bun (test-pkg)  bun add -g test-pkg',
      undefined,
    ])
  })

  it('preserves untracked PATH installations as runnable unmanaged agents', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(observed(present({ kind: 'untracked' })))

    const result = await inspectCommand('test-agent')

    expect(result.data?.inspection).toEqual({
      binaryPath: '/usr/bin/test-bin',
      installed: true,
      installedVersion: '1.2.3',
      latestVersion: '2.0.0',
      lifecycle: 'unmanaged',
      sourceLabel: 'detected on disk',
      updateLabel: 'command update',
    })
    expect(result.data?.capabilities).toEqual({
      canAutoInstall: true,
      canAutoUninstall: false,
      canRun: true,
      canSelfUpdate: true,
    })
  })

  it.each([
    ['absent', absent({ kind: 'none' }), undefined],
    ['ghost', absent({ kind: 'recorded-absent' }), trackedState],
    ['conflicting', absent({ kind: 'conflicting-source' }), trackedState],
    ['indeterminate', indeterminate(), trackedState],
  ] as const)(
    'does not report %s persisted evidence as installed without PATH evidence',
    async (_name, observation, state) => {
      resolveAgentObservationSpy.mockResolvedValueOnce(observed(observation, state, { present: false }))

      const result = await inspectCommand('test-agent')

      expect(result.data?.inspection.installed).toBe(false)
      expect(result.data?.inspection).toHaveProperty('binaryPath', undefined)
      expect(result.data?.inspection).toHaveProperty('installedVersion', undefined)
      expect(result.data?.inspection).toHaveProperty('sourceLabel', undefined)
      expect(result.data?.capabilities.canRun).toBe(false)
      expect(result.data?.capabilities.canAutoUninstall).toBe(false)
      expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    },
  )

  it('preserves the v1 unknown-agent error', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(undefined)

    const result = await inspectCommand('unknown')

    expect(result).toMatchObject({
      action: 'inspect',
      data: undefined,
      error: { code: 'AGENT_NOT_FOUND', details: { input: 'unknown' }, message: 'Unknown agent: unknown' },
      ok: false,
      target: { kind: 'agent', name: 'unknown' },
    })
    expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    expect(logSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual(['Unknown agent: unknown'])
  })

  it('reports the recorded superseded package beside the current one', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(supersededPiObservation())
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    try {
      const result = await inspectCommand('pi')

      expect(result.data?.agent.packageName).toBe('@earendil-works/pi-coding-agent')
      expect(result.data?.inspection.sourceLabel).toContain('@mariozechner/pi-coding-agent')
      expect(result.data?.inspection.latestVersion).toBeUndefined()
      expect(result.warnings).toEqual([
        expect.objectContaining({
          code: 'AGENT_PACKAGE_SUPERSEDED',
          details: expect.objectContaining({
            currentPackage: '@earendil-works/pi-coding-agent',
            recordedPackage: '@mariozechner/pi-coding-agent',
          }),
        }),
      ])
      expect(stdoutWriteSpy.mock.calls.map(call => String(call[0])).join('')).toContain('quantex uninstall pi')
    } finally {
      stdoutWriteSpy.mockRestore()
    }
  })
})

// Superseded identity is catalog-declared, so this fixture uses the real `pi` entry.
function supersededPiObservation(): ResolvedAgentObservation {
  const pathExecutable = { path: '/usr/bin/pi', present: true as const, version: '0.73.1' }
  const agent: AgentDefinition = {
    binaryName: 'pi',
    displayName: 'Pi',
    homepage: 'https://pi.dev',
    name: 'pi',
    packages: { npm: '@earendil-works/pi-coding-agent' },
    platforms: { linux: [{ packageName: '@earendil-works/pi-coding-agent', type: 'bun' }] },
    selfUpdate: { command: ['pi', 'update'] },
  }

  return {
    agent,
    capabilities: ['observe', 'update'],
    catalogMethods: [],
    executable: pathExecutable,
    installedState: { agentName: 'pi', installType: 'bun', packageName: '@mariozechner/pi-coding-agent' },
    methods: [{ packageName: '@earendil-works/pi-coding-agent', type: 'bun' }],
    observation: {
      drift: { kind: 'none' },
      executablePath: pathExecutable.path,
      kind: 'present',
      targetId: 'pi',
      version: '0.73.1',
    },
    pathExecutable,
    resolvedBinaryPath: pathExecutable.path,
  }
}

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
    /"(?:binding|drift|providerTarget|providerTargetId|providerTargetKind|receipt)"/,
  )
  expect((value as { capabilities?: unknown }).capabilities).not.toBeInstanceOf(Array)
}
