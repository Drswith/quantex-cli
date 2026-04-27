import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { updateCommand } from '../../src/commands/update'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import { ResourceLockError } from '../../src/utils/lock'
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
  lookupAliases: ['ta'],
  displayName: 'Test Agent',
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
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
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
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await updateCommand('unknown', false)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows up to date when versions match', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('1.0.0')
    await updateCommand('test-agent', false)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'))
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('updates and shows success when version differs', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    await updateCommand('test-agent', false)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('bun', [{ packageName: 'test-pkg', packageTargetKind: undefined }])
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Updating Test Agent via managed/bun... (1.0.0 -> 2.0.0)'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
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
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('bun', [
      { packageName: 'test-pkg', packageTargetKind: undefined },
      { packageName: 'pkg2', packageTargetKind: undefined },
    ])
    expect(updateSpy).not.toHaveBeenCalled()
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Updating Test Agent via managed/bun... (1.0.0 -> 2.0.0)')
    expect(output).toContain('Updating Agent 2 via managed/bun... (1.0.0 -> 2.0.0)')
    expect(output).toContain('Summary: updated 2')
  })

  it('skips detected PATH installs without auto-update support for --all', async () => {
    const manualAgent = {
      ...testAgent,
      name: 'manual-agent',
      binaryName: 'manual-bin',
      displayName: 'Manual Agent',
      packages: undefined,
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    allAgentsSpy.mockReturnValue([manualAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)

    await updateCommand(undefined, true)

    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Manual Agent: manual action required.')
    expect(output).toContain('Next step: Manual Agent uses a manually managed install source')
    expect(output).not.toContain('Updating Manual Agent')
    expect(output).not.toContain('Failed to update Manual Agent')
  })

  it('updates detected PATH installs through the agent update command for --all', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      name: 'self-updating-agent',
      binaryName: 'self-updating-bin',
      displayName: 'Self Updating Agent',
      packages: undefined,
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    allAgentsSpy.mockReturnValue([selfUpdatingAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockResolvedValue({ success: true })

    await updateCommand(undefined, true)

    expect(updateSpy).toHaveBeenCalledWith(selfUpdatingAgent, undefined)

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Updating Self Updating Agent via self-update... (1.0.0 -> latest)')
    expect(output).toContain('Self Updating Agent updated successfully')
  })

  it('shows a self-update recovery hint when self-update fails', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      name: 'self-updating-agent',
      binaryName: 'self-updating-bin',
      displayName: 'Self Updating Agent',
      homepage: 'https://example.com/self-updating-agent',
      packages: undefined,
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    agentSpy.mockReturnValue(selfUpdatingAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockResolvedValue({ success: false })

    await updateCommand('self-updating-agent', false)

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Failed to update Self Updating Agent.')
    expect(output).toContain('Next step: Try running self-updating-bin update directly.')
  })

  it('returns a stable conflict when another lifecycle operation already holds the lock', async () => {
    const selfUpdatingAgent = {
      ...testAgent,
      name: 'self-updating-agent',
      binaryName: 'self-updating-bin',
      displayName: 'Self Updating Agent',
      packages: undefined,
      selfUpdate: {
        command: ['self-updating-bin', 'update'],
      },
      platforms: {
        linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
        windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
      },
    }

    agentSpy.mockReturnValue(selfUpdatingAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockRejectedValue(new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock'))

    const result = await updateCommand('self-updating-agent', false)

    expect(result.error?.code).toBe('RESOURCE_LOCKED')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('agent lifecycle lock'))
  })

  it('returns a dry-run plan without invoking update executors', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)

    const result = await updateCommand('test-agent', false)

    expect(result.ok).toBe(true)
    expect(result.data?.results[0]?.status).toBe('planned')
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('shows error when no agent specified and no --all flag', async () => {
    await updateCommand(undefined, false)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'))
  })

  it('emits ndjson progress events for streamed updates', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'update-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue(undefined)
    updateAgentsByTypeSpy.mockResolvedValue(true)

    await updateCommand('test-agent', false)

    const startedEvent = JSON.parse(logSpy.mock.calls[0][0])
    const progressEvent = JSON.parse(logSpy.mock.calls[1][0])
    const resultEvent = JSON.parse(logSpy.mock.calls[2][0])
    expect(startedEvent.type).toBe('started')
    expect(startedEvent.data.scope).toBe('single')
    expect(progressEvent.type).toBe('progress')
    expect(progressEvent.data.status).toBe('updated')
    expect(resultEvent.type).toBe('result')
    expect(resultEvent.data.ok).toBe(true)
    expect(resultEvent.meta.runId).toBe('update-run-id')
  })
})
