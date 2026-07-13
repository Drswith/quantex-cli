import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import type { InstalledAgentState } from '../../src/state'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { listCommand } from '../../src/commands/list'
import * as legacyAgentsService from '../../src/services/agents'
import * as lifecycleObservations from '../../src/services/lifecycle-observations'

const inspectRegisteredAgentsSpy = vi.spyOn(legacyAgentsService, 'inspectRegisteredAgents')
const observeRegisteredAgentsSpy = vi.spyOn(lifecycleObservations, 'observeRegisteredAgents')

const testAgent = agent('test-agent', 'Test Agent', 'test-bin', 'test-pkg')
const secondAgent = agent('second-agent', 'Second Agent', 'second-bin', 'second-pkg')

afterAll(() => {
  inspectRegisteredAgentsSpy.mockRestore()
  observeRegisteredAgentsSpy.mockRestore()
})

describe('listCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setCliContext({ interactive: false, outputMode: 'human', runId: 'list-test' })
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    inspectRegisteredAgentsSpy.mockReset()
    inspectRegisteredAgentsSpy.mockRejectedValue(new Error('legacy list inspection must not run'))
    observeRegisteredAgentsSpy.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('routes ordered v1 rows through lifecycle observations without exposing internal fields', async () => {
    observeRegisteredAgentsSpy.mockResolvedValueOnce([
      observed(testAgent, {
        installedState: trackedState('test-agent', 'test-pkg'),
        latestVersion: '2.0.0',
        version: '1.2.3',
      }),
      observed(secondAgent, { latestVersion: '4.0.0', version: '3.4.5' }),
    ])

    const result = await listCommand()

    expect(observeRegisteredAgentsSpy).toHaveBeenCalledOnce()
    expect(inspectRegisteredAgentsSpy).not.toHaveBeenCalled()
    expect(result.data?.agents).toEqual([
      {
        binaryName: 'test-bin',
        displayName: 'Test Agent',
        installed: true,
        installedVersion: '1.2.3',
        latestVersion: '2.0.0',
        lifecycle: 'managed',
        name: 'test-agent',
        sourceLabel: 'managed via bun (test-pkg)',
        updateLabel: 'managed update',
      },
      {
        binaryName: 'second-bin',
        displayName: 'Second Agent',
        installed: true,
        installedVersion: '3.4.5',
        latestVersion: '4.0.0',
        lifecycle: 'unmanaged',
        name: 'second-agent',
        sourceLabel: 'detected in PATH',
        updateLabel: 'manual update',
      },
    ])
  })

  it('preserves human status, version, source, and update labels', async () => {
    const selfUpdatingAgent = { ...secondAgent, selfUpdate: { command: ['second-bin', 'update'] } }
    observeRegisteredAgentsSpy.mockResolvedValueOnce([
      observed(testAgent, {
        installedState: trackedState('test-agent', 'test-pkg'),
        version: undefined,
      }),
      observed(selfUpdatingAgent, { version: '3.4.5' }),
      observed(agent('missing-agent', 'Missing Agent', 'missing-bin', 'missing-pkg'), { present: false }),
    ])

    await listCommand()

    const output = logSpy.mock.calls.map((call: any[]) => call[0]).join('\n')
    expect(output).toContain('unknown version')
    expect(output).toContain('managed update')
    expect(output).toContain('managed via bun (test-pkg)')
    expect(output).toContain('command update')
    expect(output).toContain('detected in PATH')
    expect(output).toContain('not installed')
  })

  it('emits the unchanged structured list envelope in json mode', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'list-json-test' })
    observeRegisteredAgentsSpy.mockResolvedValueOnce([
      observed(testAgent, {
        installedState: trackedState('test-agent', 'test-pkg'),
        version: '1.2.3',
      }),
    ])

    const result = await listCommand()

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload).toMatchObject({ action: 'list', error: null, ok: true })
    expect(payload.data.agents).toEqual([
      {
        binaryName: 'test-bin',
        displayName: 'Test Agent',
        installed: true,
        installedVersion: '1.2.3',
        lifecycle: 'managed',
        name: 'test-agent',
        sourceLabel: 'managed via bun (test-pkg)',
        updateLabel: 'managed update',
      },
    ])
    expect(result.data?.agents[0]).toHaveProperty('latestVersion', undefined)
  })
})

function agent(name: string, displayName: string, binaryName: string, packageName: string): AgentDefinition {
  return {
    binaryName,
    displayName,
    homepage: 'https://example.com',
    name,
    packages: { npm: packageName },
    platforms: { linux: [{ packageName, type: 'bun' }] },
  }
}

function observed(
  target: AgentDefinition,
  options: {
    installedState?: InstalledAgentState
    latestVersion?: string
    present?: boolean
    version?: string
  } = {},
): ResolvedAgentObservation {
  const present = options.present ?? true
  const executable = present
    ? { path: `/usr/bin/${target.binaryName}`, present: true as const, version: options.version }
    : { present: false as const }
  const methods: InstallMethod[] = [{ packageName: target.packages?.npm, type: 'bun' }]

  return {
    agent: target,
    capabilities: ['observe'],
    catalogMethods: [],
    executable,
    installedState: options.installedState,
    latestVersion: options.latestVersion,
    methods,
    observation: present
      ? {
          drift: { kind: options.installedState ? 'none' : 'untracked' },
          executablePath: executable.path,
          kind: 'present',
          targetId: target.name,
          version: options.version,
        }
      : { drift: { kind: 'none' }, kind: 'absent', targetId: target.name },
    pathExecutable: executable,
    resolvedBinaryPath: present ? executable.path : undefined,
  }
}

function trackedState(agentName: string, packageName: string): InstalledAgentState {
  return { agentName, installType: 'bun', packageName }
}
