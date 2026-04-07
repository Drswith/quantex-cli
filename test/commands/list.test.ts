import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { listCommand } from '../../src/commands/list'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')

afterAll(() => {
  allAgentsSpy.mockRestore()
  binaryInPathSpy.mockRestore()
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
  installMethods: [],
}

describe('listCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    allAgentsSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('lists all agents with installed status', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    await listCommand()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('AI Agents'))
    expect(binaryInPathSpy).toHaveBeenCalledWith('test-bin')
  })

  it('shows version for installed agents', async () => {
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('2.0.0')
    await listCommand()
    const calls = logSpy.mock.calls.map((c: any[]) => c[0])
    const versionCall = calls.find((c: string) => c.includes('2.0.0'))
    expect(versionCall).toBeDefined()
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
