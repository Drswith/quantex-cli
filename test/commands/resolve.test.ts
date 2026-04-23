import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { resolveCommand } from '../../src/commands/resolve'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')
const binaryPathSpy = vi.spyOn(version, 'getBinaryPath')

afterAll(() => {
  agentSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedStateSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
  binaryPathSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  lookupAliases: ['ta'],
  displayName: 'Test Agent',
  description: 'A test agent',
  homepage: 'https://example.com',
  packages: { npm: 'test-pkg' },
  binaryName: 'test-bin',
  platforms: {
    linux: [{ type: 'bun' as const }],
    macos: [{ type: 'bun' as const }],
    windows: [{ type: 'bun' as const }],
  },
}

describe('resolveCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    agentSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedStateSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    binaryPathSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await resolveCommand('unknown')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows error when the agent is not installed', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    await resolveCommand('test-agent')

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('is not installed'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('quantex ensure test-agent'))
  })

  it('shows resolved executable information for an installed agent', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    binaryPathSpy.mockResolvedValue('/usr/bin/test-bin')

    await resolveCommand('test-agent')

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Path:')
    expect(output).toContain('/usr/bin/test-bin')
    expect(output).toContain('Launch:')
    expect(output).toContain('Install Type:')
  })

  it('emits a structured envelope in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'resolve-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    installedVerSpy.mockResolvedValue('1.0.0')
    binaryPathSpy.mockResolvedValue('/usr/bin/test-bin')

    await resolveCommand('test-agent')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('resolve')
    expect(payload.data.agent.name).toBe('test-agent')
    expect(payload.data.resolution.binaryPath).toBe('/usr/bin/test-bin')
    expect(payload.data.resolution.suggestedLaunchCommand).toEqual(['/usr/bin/test-bin'])
    expect(payload.meta.runId).toBe('resolve-run-id')
  })

  it('emits machine-actionable install guidance when the agent is not installed', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'resolve-missing-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    await resolveCommand('test-agent')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('AGENT_NOT_INSTALLED')
    expect(payload.data.agent.name).toBe('test-agent')
    expect(payload.data.resolution.installed).toBe(false)
    expect(payload.data.resolution.installGuidance.suggestedAction).toBe('ensure-agent-installed')
    expect(payload.data.resolution.installGuidance.suggestedEnsureCommand).toBe('quantex ensure test-agent')
    expect(payload.data.resolution.installGuidance.installMethods[0]).toMatchObject({
      command: 'bun add -g test-pkg',
      type: 'bun',
    })
  })
})
