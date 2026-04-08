import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { listCommand } from '../../src/commands/list'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')

afterAll(() => {
  allAgentsSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedStateSpy.mockRestore()
  installedVerSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  aliases: ['ta'],
  displayName: 'Test Agent',
  description: 'test',
  homepage: 'https://example.com',
  package: 'test-pkg',
  binaryName: 'test-bin',
  platforms: {},
}

describe('listCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    allAgentsSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedStateSpy.mockClear()
    installedVerSpy.mockClear()
    installedStateSpy.mockResolvedValue(undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('lists all agents with installed status', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    installedVerSpy.mockResolvedValue('1.0.0')
    await listCommand()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('AI Agents'))
    expect(binaryInPathSpy).toHaveBeenCalledWith('test-bin')
  })

  it('shows version for installed agents', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    installedVerSpy.mockResolvedValue('2.0.0')
    await listCommand()
    const calls = logSpy.mock.calls.map((c: any[]) => c[0])
    const versionCall = calls.find((c: string) => c.includes('2.0.0'))
    expect(versionCall).toBeDefined()
  })

  it('shows install source and managed updates for tracked installs', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    installedVerSpy.mockResolvedValue('1.0.0')
    await listCommand()
    const calls = logSpy.mock.calls.map((c: any[]) => c[0])
    const installedCall = calls.find((c: string) => c.includes('managed update') && c.includes('managed via bun (test-pkg)'))
    expect(installedCall).toBeDefined()
  })

  it('shows installed with unknown version when version cannot be obtained', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue(undefined)
    await listCommand()
    const calls = logSpy.mock.calls.map((c: any[]) => c[0])
    const installedCall = calls.find((c: string) => c.includes('installed') && c.includes('unknown version'))
    expect(installedCall).toBeDefined()
  })

  it('shows manual updates when install source is only detected from PATH', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    await listCommand()
    const calls = logSpy.mock.calls.map((c: any[]) => c[0])
    const manualUpdateCall = calls.find((c: string) => c.includes('manual update') && c.includes('detected in PATH'))
    expect(manualUpdateCall).toBeDefined()
  })

  it('shows not installed for missing agents', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(false)
    await listCommand()
    const calls = logSpy.mock.calls.map((c: any[]) => c[0])
    const notInstalledCall = calls.find((c: string) => c.includes('not installed'))
    expect(notInstalledCall).toBeDefined()
    expect(installedVerSpy).not.toHaveBeenCalled()
  })
})
