import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { updateCommand } from '../../src/commands/update'
import * as pm from '../../src/package-manager'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const updateSpy = vi.spyOn(pm, 'updateAgent')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')

afterAll(() => {
  agentSpy.mockRestore()
  allAgentsSpy.mockRestore()
  updateSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  aliases: ['ta'],
  displayName: 'Test Agent',
  description: 'test',
  package: 'test-pkg',
  binaryName: 'test-bin',
  installMethods: [],
}

describe('updateCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    agentSpy.mockClear()
    allAgentsSpy.mockClear()
    updateSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await updateCommand('unknown', false)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows up to date when versions match', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('1.0.0')
    await updateCommand('test-agent', false)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'))
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('updates and shows success when version differs', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    updateSpy.mockResolvedValue(true)
    await updateCommand('test-agent', false)
    expect(updateSpy).toHaveBeenCalledWith(testAgent)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('updates all installed agents with --all flag', async () => {
    const agent2 = { ...testAgent, name: 'agent2', binaryName: 'bin2', package: 'pkg2', displayName: 'Agent 2' }
    allAgentsSpy.mockReturnValue([testAgent, agent2])
    binaryInPathSpy.mockImplementation(async (bin: string) => bin === 'test-bin')
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    updateSpy.mockResolvedValue(true)
    await updateCommand(undefined, true)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith(testAgent)
  })

  it('shows error when no agent specified and no --all flag', async () => {
    await updateCommand(undefined, false)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'))
  })
})
