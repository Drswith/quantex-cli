import type { ManagedInstallType } from '../../src/package-manager'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { cancelCliContextOperations, resetCliContext, setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
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
const managedInstalledVersionSpy = vi.spyOn(pm, 'getManagedInstalledPackageVersion')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')

afterAll(() => {
  agentSpy.mockRestore()
  allAgentsSpy.mockRestore()
  updateSpy.mockRestore()
  updateAgentsByTypeSpy.mockRestore()
  managedInstalledVersionSpy.mockRestore()
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
    resetCliContext()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    allAgentsSpy.mockClear()
    updateSpy.mockClear()
    updateAgentsByTypeSpy.mockClear()
    managedInstalledVersionSpy.mockClear()
    managedInstalledVersionSpy.mockResolvedValue(undefined)
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    installedStateSpy.mockClear()
  })

  afterEach(() => {
    resetCliContext()
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
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('bun', [
      { packageName: 'test-pkg', packageTargetKind: undefined },
    ])
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updating Test Agent via managed/bun... (1.0.0 -> 2.0.0)'),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('updates pip-managed agents via updateAgentsByType when versions differ', async () => {
    const pipAgent = {
      ...testAgent,
      name: 'pip-agent',
      binaryName: 'pip-bin',
      displayName: 'Pip Agent',
      packages: { pip: 'pip-pkg' },
      platforms: {
        linux: [{ type: 'pip' as const, packageName: 'pip-pkg' }],
        macos: [{ type: 'pip' as const, packageName: 'pip-pkg' }],
        windows: [{ type: 'pip' as const, packageName: 'pip-pkg' }],
      },
    }

    agentSpy.mockReturnValue(pipAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue({
      agentName: 'pip-agent',
      installType: 'pip',
      packageName: 'pip-pkg',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    await updateCommand('pip-agent', false)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('pip', [
      { packageName: 'pip-pkg', packageTargetKind: undefined },
    ])
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updating Pip Agent via managed/pip... (1.0.0 -> latest)'),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('updates uv-managed agents via updateAgentsByType with package args when versions differ', async () => {
    const uvAgent = {
      ...testAgent,
      name: 'uv-agent',
      binaryName: 'uv-bin',
      displayName: 'Uv Agent',
      packages: { uv: 'uv-pkg' },
      platforms: {
        linux: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
        macos: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
        windows: [{ packageInstallArgs: ['--python', '3.12'], type: 'uv' as const }],
      },
    }

    agentSpy.mockReturnValue(uvAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue({
      agentName: 'uv-agent',
      installType: 'uv',
      packageInstallArgs: ['--python', '3.12'],
      packageName: 'uv-pkg',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    await updateCommand('uv-agent', false)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('uv', [
      { packageInstallArgs: ['--python', '3.12'], packageName: 'uv-pkg', packageTargetKind: undefined },
    ])
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updating Uv Agent via managed/uv... (1.0.0 -> latest)'),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('updates deno-managed agents via updateAgentsByType with executable name and package args', async () => {
    const denoAgent = {
      ...testAgent,
      name: 'deno-agent',
      binaryName: 'deno-bin',
      displayName: 'Deno Agent',
      packages: { deno: 'jsr:@scope/deno-agent' },
      platforms: {
        linux: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
        macos: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
        windows: [{ packageInstallArgs: ['--allow-net'], type: 'deno' as const }],
      },
    }

    agentSpy.mockReturnValue(denoAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue({
      agentName: 'deno-agent',
      binaryName: 'deno-bin',
      installType: 'deno',
      packageInstallArgs: ['--allow-net'],
      packageName: 'jsr:@scope/deno-agent',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })
    await updateCommand('deno-agent', false)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('deno', [
      {
        binaryName: 'deno-bin',
        packageInstallArgs: ['--allow-net'],
        packageName: 'jsr:@scope/deno-agent',
        packageTargetKind: undefined,
      },
    ])
    expect(updateSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updating Deno Agent via managed/deno... (1.0.0 -> latest)'),
    )
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('updated successfully'))
  })

  it('does not update tracked script installs through a candidate pip method', async () => {
    const scriptAndPipAgent = {
      ...testAgent,
      name: 'script-pip-agent',
      binaryName: 'script-pip-bin',
      displayName: 'Script Pip Agent',
      packages: { pip: 'script-pip-pkg' },
      platforms: {
        linux: [
          { command: 'curl https://example.com/install | bash', type: 'script' as const },
          { packageName: 'script-pip-pkg', type: 'pip' as const },
        ],
        macos: [
          { command: 'curl https://example.com/install | bash', type: 'script' as const },
          { packageName: 'script-pip-pkg', type: 'pip' as const },
        ],
        windows: [{ packageName: 'script-pip-pkg', type: 'pip' as const }],
      },
    }

    agentSpy.mockReturnValue(scriptAndPipAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'script-pip-agent',
      command: 'curl https://example.com/install | bash',
      installType: 'script',
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: true })

    await updateCommand('script-pip-agent', false)

    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Script Pip Agent: manual action required.')
    expect(output).toContain('manually managed install source')
  })

  it('batches known package-manager updates for --all', async () => {
    const agent2 = {
      ...testAgent,
      name: 'agent2',
      binaryName: 'bin2',
      packages: { npm: 'pkg2' },
      displayName: 'Agent 2',
    }
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
    ])
    expect(updateSpy).not.toHaveBeenCalled()
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Updating Test Agent via managed/bun... (1.0.0 -> 2.0.0)')
    expect(output).toContain('Agent 2: manual action required.')
    expect(output).toContain('detected in PATH but not tracked as a Quantex-managed install')
    expect(output).toContain('Summary: updated 1, manual 1')
  })

  it('stops batch update when the cli context is cancelled', async () => {
    const agent2 = {
      ...testAgent,
      name: 'agent2',
      binaryName: 'bin2',
      packages: { npm: 'pkg2' },
      displayName: 'Agent 2',
    }

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
        }
      }

      if (name === 'agent2') {
        return {
          agentName: 'agent2',
          installType: 'bun',
          packageName: 'pkg2',
        }
      }

      return undefined
    })
    updateAgentsByTypeSpy.mockResolvedValue(false)
    updateSpy.mockImplementation(async agent => {
      if (agent.name === 'test-agent') {
        await cancelCliContextOperations()
        return { success: true }
      }

      return { success: true }
    })

    const result = await updateCommand(undefined, true)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CANCELLED')
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith(
      testAgent,
      expect.objectContaining({
        agentName: 'test-agent',
        installType: 'bun',
      }),
    )
  })

  it('does not report overall success for single-agent update when cancelled mid-update', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
    updateAgentsByTypeSpy.mockResolvedValue(false)
    updateSpy.mockImplementation(async () => {
      await cancelCliContextOperations()
      return { success: true }
    })

    const result = await updateCommand('test-agent', false)

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CANCELLED')
    expect(result.data?.scope).toBe('single')
    expect(result.data?.results).toEqual([
      expect.objectContaining({
        name: 'test-agent',
        status: 'updated',
      }),
    ])
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('does not report overall success for update --all after timeout cancellation', async () => {
    const agent2 = {
      ...testAgent,
      name: 'agent2',
      binaryName: 'bin2',
      packages: { npm: 'pkg2' },
      displayName: 'Agent 2',
    }

    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-update-timeout-run',
      timeoutMs: 50,
    })
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
        }
      }

      if (name === 'agent2') {
        return {
          agentName: 'agent2',
          installType: 'bun',
          packageName: 'pkg2',
        }
      }

      return undefined
    })
    updateAgentsByTypeSpy.mockResolvedValue(false)
    updateSpy.mockImplementation(async agent => {
      if (agent.name === 'test-agent') {
        await new Promise(resolve => setTimeout(resolve, 200))
        return { success: true }
      }

      return { success: true }
    })

    const runtimeResult = await executeCommandWithRuntime({
      action: 'update',
      run: () => updateCommand(undefined, true),
      target: {
        kind: 'agent',
      },
    })

    await new Promise(resolve => setTimeout(resolve, 300))

    expect(runtimeResult.ok).toBe(false)
    expect(['CANCELLED', 'TIMEOUT']).toContain(runtimeResult.error?.code)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith(
      testAgent,
      expect.objectContaining({
        agentName: 'test-agent',
        installType: 'bun',
      }),
    )
  })

  it('falls back from failed grouped updates without concurrent lifecycle lock contention', async () => {
    const agent2 = {
      ...testAgent,
      name: 'agent2',
      binaryName: 'bin2',
      packages: { npm: 'pkg2' },
      displayName: 'Agent 2',
    }
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
        }
      }

      if (name === 'agent2') {
        return {
          agentName: 'agent2',
          installType: 'bun',
          packageName: 'pkg2',
        }
      }

      return undefined
    })
    updateAgentsByTypeSpy.mockResolvedValue(false)
    let activeUpdates = 0
    let maxActiveUpdates = 0
    updateSpy.mockImplementation(async () => {
      activeUpdates += 1
      maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates)
      await Promise.resolve()
      activeUpdates -= 1
      return { success: true }
    })

    const result = await updateCommand(undefined, true)

    expect(result.ok).toBe(true)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('bun', [
      { packageName: 'test-pkg', packageTargetKind: undefined },
      { packageName: 'pkg2', packageTargetKind: undefined },
    ])
    expect(updateSpy).toHaveBeenCalledTimes(2)
    expect(maxActiveUpdates).toBe(1)

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Test Agent updated successfully')
    expect(output).toContain('Agent 2 updated successfully')
    expect(output).toContain('Summary: updated 2')
    expect(output).not.toContain('locked')
  })

  it('does not report package-less entries as updated in mixed managed batches', async () => {
    const brokenAgent = {
      ...testAgent,
      name: 'broken-agent',
      binaryName: 'broken-bin',
      displayName: 'Broken Agent',
      packages: undefined,
    }
    allAgentsSpy.mockReturnValue([testAgent, brokenAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    installedStateSpy.mockImplementation(async (name: string) => {
      if (name === 'test-agent') {
        return {
          agentName: 'test-agent',
          installType: 'bun',
          packageName: 'test-pkg',
        }
      }

      if (name === 'broken-agent') {
        return {
          agentName: 'broken-agent',
          installType: 'bun',
        }
      }

      return undefined
    })
    updateAgentsByTypeSpy.mockResolvedValue(true)
    updateSpy.mockResolvedValue({ success: false })

    const result = await updateCommand(undefined, true)

    expect(result.ok).toBe(false)
    expect(updateAgentsByTypeSpy).toHaveBeenCalledWith('bun', [
      { packageName: 'test-pkg', packageTargetKind: undefined },
    ])
    expect(updateSpy).toHaveBeenCalledWith(
      brokenAgent,
      expect.objectContaining({
        agentName: 'broken-agent',
        installType: 'bun',
      }),
    )

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Test Agent updated successfully')
    expect(output).toContain('Failed to update Broken Agent.')
    expect(output).toContain('Summary: updated 1, failed 1')
  })

  it('reports tracked Bun agents as up to date when installed package versions match latest', async () => {
    const piAgent = {
      ...testAgent,
      name: 'pi',
      binaryName: 'pi',
      packages: { npm: '@mariozechner/pi-coding-agent' },
      displayName: 'Pi',
    }

    allAgentsSpy.mockReturnValue([testAgent, piAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue(undefined)
    latestVerSpy.mockImplementation(async (packageName: string) => {
      if (packageName === 'test-pkg') return '1.0.43'
      if (packageName === '@mariozechner/pi-coding-agent') return '0.73.1'
      return undefined
    })
    installedStateSpy.mockImplementation(async (name: string) => {
      if (name === 'test-agent') {
        return {
          agentName: 'test-agent',
          installType: 'bun',
          packageName: 'test-pkg',
        }
      }

      if (name === 'pi') {
        return {
          agentName: 'pi',
          installType: 'bun',
          packageName: '@mariozechner/pi-coding-agent',
        }
      }

      return undefined
    })
    managedInstalledVersionSpy.mockImplementation(async (_type: ManagedInstallType, packageName: string) =>
      packageName === 'test-pkg' ? '1.0.43' : packageName === '@mariozechner/pi-coding-agent' ? '0.73.1' : undefined,
    )

    await updateCommand(undefined, true)

    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
    expect(installedVerSpy).not.toHaveBeenCalled()

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Test Agent is up to date (1.0.43)')
    expect(output).toContain('Pi is up to date (0.73.1)')
    expect(output).toContain('Summary: up to date 2')
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
    expect(output).toContain('detected in PATH but not tracked as a Quantex-managed install')
    expect(output).not.toContain('Updating Manual Agent')
    expect(output).not.toContain('Failed to update Manual Agent')
  })

  it('skips detected PATH installs with self-update support for --all when they are untracked', async () => {
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

    expect(updateSpy).not.toHaveBeenCalled()
    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Self Updating Agent: manual action required.')
    expect(output).toContain('detected in PATH but not tracked as a Quantex-managed install')
    expect(output).toContain('quantex inspect self-updating-agent --json')
  })

  it('includes tracked script installs in update --all via self-update', async () => {
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
    installedVerSpy.mockResolvedValueOnce('1.0.0').mockResolvedValueOnce('2.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'self-updating-agent',
      installType: 'script',
      command: 'curl https://example.com/install | bash',
    })
    updateSpy.mockResolvedValue({ success: true })

    await updateCommand(undefined, true)

    expect(updateAgentsByTypeSpy).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalledWith(
      selfUpdatingAgent,
      expect.objectContaining({
        command: 'curl https://example.com/install | bash',
        installType: 'script',
      }),
    )

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Updating Self Updating Agent via self-update... (1.0.0 -> 2.0.0)')
    expect(output).toContain('Self Updating Agent updated successfully')
  })

  it('reports self-update as up to date when the version does not change', async () => {
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
    installedVerSpy.mockResolvedValueOnce('1.0.0').mockResolvedValueOnce('1.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue({
      agentName: 'self-updating-agent',
      installType: 'script',
      command: 'curl https://example.com/install | bash',
    })
    updateSpy.mockResolvedValue({ success: true })

    await updateCommand('self-updating-agent', false)

    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Self Updating Agent is up to date (1.0.0)')
    expect(output).not.toContain('Self Updating Agent updated successfully')
  })

  it('still allows explicit single-agent updates for untracked PATH installs with self-update support', async () => {
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
    installedVerSpy.mockResolvedValueOnce('1.0.0').mockResolvedValueOnce('2.0.0')
    latestVerSpy.mockResolvedValue(undefined)
    installedStateSpy.mockResolvedValue(undefined)
    updateSpy.mockResolvedValue({ success: true })

    await updateCommand('self-updating-agent', false)

    expect(updateSpy).toHaveBeenCalledWith(selfUpdatingAgent, undefined)
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Updating Self Updating Agent via self-update... (1.0.0 -> 2.0.0)')
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
