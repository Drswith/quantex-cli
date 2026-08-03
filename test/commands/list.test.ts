import type { AgentDefinition, InstallMethod } from '../../src/agents'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import type { InstalledAgentState } from '../../src/state'
import process from 'node:process'
import stringWidth from 'string-width'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { listCommand } from '../../src/commands/list'
import * as legacyAgentsService from '../../src/services/agents'
import * as coreReadObservations from '../../src/services/core-read-observations'

const inspectRegisteredAgentsSpy = vi.spyOn(legacyAgentsService, 'inspectRegisteredAgents')
const observeRegisteredAgentsSpy = vi.spyOn(coreReadObservations, 'observeCliReadRegisteredAgents')

const testAgent = agent('test-agent', 'Test Agent', 'test-bin', 'test-pkg')
const secondAgent = agent('second-agent', 'Second Agent', 'second-bin', 'second-pkg')
const originalStdoutColumns = process.stdout.columns

afterAll(() => {
  inspectRegisteredAgentsSpy.mockRestore()
  observeRegisteredAgentsSpy.mockRestore()
})

describe('listCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setCliContext({ colorMode: 'never', interactive: false, outputMode: 'human', runId: 'list-test' })
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    inspectRegisteredAgentsSpy.mockReset()
    inspectRegisteredAgentsSpy.mockRejectedValue(new Error('legacy list inspection must not run'))
    observeRegisteredAgentsSpy.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: originalStdoutColumns })
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

  it('prioritizes aligned lifecycle summary and an explicit detail path in human output', async () => {
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
    expect(output).toContain('Agent')
    expect(output).toContain('Installed')
    expect(output).toContain('Source')
    expect(output).toContain('Managed')
    expect(output).toContain('Available')
    expect(output).toContain('unknown')
    expect(output).toContain('bun')
    expect(output).toContain('PATH')
    expect(output).toContain('managed')
    expect(output).toContain('command')
    expect(output).toContain('2 installed · 1 not installed')
    expect(output).toContain('Details: qtx inspect <agent>')
    expect(output).not.toContain('managed via bun (test-pkg)')
    expect(output).not.toContain('detected in PATH')
  })

  it('shows a version as available only when it is semantically newer', async () => {
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 120 })
    observeRegisteredAgentsSpy.mockResolvedValueOnce([
      observed(agent('newer-agent', 'Newer Agent', 'newer-bin', 'newer-pkg'), {
        latestVersion: '2.0.0',
        version: '1.2.3',
      }),
      observed(agent('equal-agent', 'Equal Agent', 'equal-bin', 'equal-pkg'), {
        latestVersion: '3.4.5',
        version: '3.4.5',
      }),
      observed(agent('older-agent', 'Older Agent', 'older-bin', 'older-pkg'), {
        latestVersion: '3.9.0',
        version: '4.0.0',
      }),
      observed(agent('unknown-agent', 'Unknown Agent', 'unknown-bin', 'unknown-pkg'), {
        latestVersion: '5.0.0',
        version: 'main',
      }),
    ])

    await listCommand()

    const lines: string[] = logSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join('\n')
      .split('\n')
    expect(lines.find(line => line.includes('Newer Agent'))).toContain('2.0.0')
    expect(lines.find(line => line.includes('Equal Agent'))).toMatch(/—\s*$/u)
    expect(lines.find(line => line.includes('Older Agent'))).toMatch(/—\s*$/u)
    expect(lines.find(line => line.includes('Unknown Agent'))).toMatch(/—\s*$/u)
  })

  it('renders compact recorded and PATH-only installation sources in wide output', async () => {
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 80 })
    observeRegisteredAgentsSpy.mockResolvedValueOnce([
      observed(testAgent, { installedState: trackedState('test-agent', 'test-pkg'), version: '1.2.3' }),
      observed(agent('npm-agent', 'Npm Agent', 'npm-bin', 'npm-pkg'), {
        installedState: trackedState('npm-agent', 'npm-pkg', 'npm'),
        version: '1.2.3',
      }),
      observed(agent('script-agent', 'Script Agent', 'script-bin', 'script-pkg'), {
        installedState: trackedState('script-agent', undefined, 'script'),
        version: '1.2.3',
      }),
      observed(agent('binary-agent', 'Binary Agent', 'binary-bin', 'binary-pkg'), {
        installedState: trackedState('binary-agent', undefined, 'binary'),
        version: '1.2.3',
      }),
      observed(secondAgent, { version: '3.4.5' }),
    ])

    await listCommand()

    const output = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(output).toContain('Source')
    expect(output).toContain('bun')
    expect(output).toContain('npm')
    expect(output).toContain('script')
    expect(output).toContain('binary')
    expect(output).toContain('PATH')
    expect(output).not.toContain('managed via bun (test-pkg)')
    expect(output).not.toContain('detected in PATH')
  })

  it('drops optional columns before terminal wrapping in a narrow terminal', async () => {
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 32 })
    observeRegisteredAgentsSpy.mockResolvedValueOnce([
      observed(testAgent, { installedState: trackedState('test-agent', 'test-pkg'), version: '1.2.3' }),
      observed(agent('missing-agent', 'Missing Agent', 'missing-bin', 'missing-pkg'), { present: false }),
    ])

    await listCommand()

    const lines: string[] = logSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join('\n')
      .split('\n')
    const header = lines.find(line => line.includes('Installed')) ?? ''
    expect(header).toContain('Agent')
    expect(header).not.toContain('Version')
    expect(header).not.toContain('Source')
    expect(header).not.toContain('Managed')
    expect(header).not.toContain('Available')
    expect(lines.every(line => stringWidth(line) <= 32)).toBe(true)
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

function trackedState(
  agentName: string,
  packageName: string | undefined,
  installType: InstalledAgentState['installType'] = 'bun',
): InstalledAgentState {
  return { agentName, installType, ...(packageName ? { packageName } : {}) }
}
