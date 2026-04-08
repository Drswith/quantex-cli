import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { updateCommand } from '../../src/commands/update'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const updateSpy = vi.spyOn(pm, 'updateAgent')
const updateAgentsByTypeSpy = vi.spyOn(pm, 'updateAgentsByType')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')

afterAll(() => {
  agentSpy.mockRestore()
  allAgentsSpy.mockRestore()
  updateSpy.mockRestore()
  updateAgentsByTypeSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
  installedStateSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  aliases: ['ta'],
  displayName: 'Test Agent',
  description: 'test',
  homepage: 'https://example.com',
  packages: { npm: 'test-pkg' },
  binaryName: 'test-bin',
  platforms: {
    linux: [{ type: 'bun' as const }],
    macos: [{ type: 'bun' as const }],
    windows: [{ type: 'bun' as const }],
  },
}

describe('updateCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    agentSpy.mockClear()
    allAgentsSpy.mockClear()
    updateSpy.mockClear()
    updateAgentsByTypeSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    installedStateSpy.mockClear()
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
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('1.0.0')
    await updateCommand('test-agent', false)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'))
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('updates and shows success when version differs', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockResolvedValue({ success: true })
    await updateCommand('test-agent', false)
    expect(updateSpy).toHaveBeenCalledWith(testAgent, undefined)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('batches known package-manager updates for --all', async () => {
    const agent2 = { ...testAgent, name: 'agent2', binaryName: 'bin2', packages: { npm: 'pkg2' }, displayName: 'Agent 2' }
    allAgentsSpy.mockReturnValue([testAgent, agent2])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockImplementation(async (name: string) => {
      if (name === 'test-agent') {
        return {
          agentName: 'test-agent',
          installType: 'bun',
          packageName: 'test-pkg',
          command: 'bun add -g test-pkg',
        }
      }

      return undefined
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    await updateCommand(undefined, true)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('bun', [{ packageName: 'test-pkg', packageTargetKind: undefined }])
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith(agent2, undefined)
  })

  it('shows error when no agent specified and no --all flag', async () => {
    await updateCommand(undefined, false)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'))
  })
})
