import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { infoCommand } from '../../src/commands/info'
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
  selfUpdate: { command: ['test-bin', 'update'] },
}

afterAll(() => {
  resolveAgentInspectionSpy.mockRestore()
  resolveAgentObservationSpy.mockRestore()
})

describe('infoCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setCliContext({ interactive: false, outputMode: 'human', runId: 'info-test' })
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    resolveAgentInspectionSpy.mockReset()
    resolveAgentInspectionSpy.mockRejectedValue(new Error('legacy info inspection must not run'))
    resolveAgentObservationSpy.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('routes the exact v1 success projection through lifecycle observation', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(observed())

    const result = await infoCommand('ta')

    expect(resolveAgentObservationSpy).toHaveBeenCalledWith('ta')
    expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      action: 'info',
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
        inspection: {
          binaryPath: '/usr/bin/test-bin',
          installed: true,
          installedVersion: '1.2.3',
          latestVersion: '2.0.0',
          lifecycle: 'managed',
          sourceLabel: 'managed via bun (test-pkg)',
        },
      },
      error: null,
      ok: true,
      target: { kind: 'agent', name: 'test-agent' },
    })
    expect(result.data?.inspection).not.toHaveProperty('drift')
    expect(result.data?.inspection).not.toHaveProperty('receipt')
    expect(result.data?.inspection).not.toHaveProperty('capabilities')
  })

  it('preserves human details and install-method rendering', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(observed())

    await infoCommand('test-agent')

    const output = logSpy.mock.calls.map((call: any[]) => call[0]).join('\n')
    for (const value of [
      'test-agent',
      'ta',
      'test-pkg',
      'test-bin',
      'test-bin update',
      'managed via bun (test-pkg)',
      'managed',
      '1.2.3',
      '2.0.0',
      '/usr/bin/test-bin',
      'Install Methods',
      'managed/bun (test-pkg)',
      'bun add -g test-pkg',
    ]) {
      expect(output).toContain(value)
    }
  })

  it('preserves the v1 unknown-agent error through lifecycle observation', async () => {
    resolveAgentObservationSpy.mockResolvedValueOnce(undefined)

    const result = await infoCommand('missing')

    expect(resolveAgentObservationSpy).toHaveBeenCalledWith('missing')
    expect(resolveAgentInspectionSpy).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      action: 'info',
      data: undefined,
      error: {
        code: 'AGENT_NOT_FOUND',
        details: { input: 'missing' },
        message: 'Unknown agent: missing',
      },
      ok: false,
      target: { kind: 'agent', name: 'missing' },
    })
  })
})

function observed(): ResolvedAgentObservation {
  const methods: InstallMethod[] = [{ packageName: 'test-pkg', type: 'bun' }]
  const executable = { path: '/usr/bin/test-bin', present: true as const, version: '1.2.3' }

  return {
    agent: testAgent,
    capabilities: ['observe', 'update'],
    catalogMethods: [],
    executable,
    installedState: { agentName: 'test-agent', installType: 'bun', packageName: 'test-pkg' },
    latestVersion: '2.0.0',
    methods,
    observation: {
      drift: { kind: 'none' },
      executablePath: '/usr/bin/test-bin',
      kind: 'present',
      targetId: 'test-agent',
      version: '1.2.3',
    },
    pathExecutable: executable,
    receipt: {
      kind: 'lifecycle-receipt',
      providerId: 'bun',
      providerTargetId: 'test-pkg',
      providerTargetKind: 'package',
      schemaVersion: 1,
      targetId: 'test-agent',
      verifiedAt: '2026-07-12T08:00:00.000Z',
    },
    resolvedBinaryPath: '/usr/bin/test-bin',
  }
}
