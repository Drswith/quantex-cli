import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { infoCommand } from '../../src/commands/info'
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
  aliases: ['ta'],
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

describe('infoCommand', () => {
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
    await infoCommand('unknown')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows all agent details for known agent', async () => {
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
    await infoCommand('test-agent')
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('test-agent')
    expect(output).toContain('ta')
    expect(output).toContain('test-pkg')
    expect(output).toContain('test-bin')
    expect(output).toContain('managed via bun (test-pkg)')
    expect(output).toContain('managed')
    expect(output).toContain('1.0.0')
    expect(output).toContain('2.0.0')
    expect(output).toContain('/usr/bin/test-bin')
  })

  it('shows install methods with platform support indicators', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    await infoCommand('test-agent')
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Install Methods')
    expect(output).toContain('managed/bun')
    expect(output).toContain('bun add -g test-pkg')
  })
})
