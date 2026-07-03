import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { uninstallCommand } from '../../src/commands/uninstall'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import { ResourceLockError } from '../../src/utils/lock'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const uninstallSpy = vi.spyOn(pm, 'uninstallAgent')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')

afterAll(() => {
  agentSpy.mockRestore()
  uninstallSpy.mockRestore()
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

const managedInstalledState = {
  agentName: 'test-agent',
  installType: 'bun' as const,
  packageName: 'test-pkg',
}

describe('uninstallCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    uninstallSpy.mockClear()
    installedStateSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await uninstallCommand('unknown')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('calls uninstallAgent and shows success', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    uninstallSpy.mockResolvedValue(true)
    await uninstallCommand('test-agent')
    expect(uninstallSpy).toHaveBeenCalledWith(testAgent)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('uninstalled successfully'))
  })

  it('shows failure message', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    uninstallSpy.mockResolvedValue(false)
    const result = await uninstallCommand('test-agent')
    expect(result.error?.code).toBe('UNINSTALL_FAILED')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to uninstall'))
  })

  it('returns unmanaged uninstall error when the agent has no managed installed state', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'unmanaged-id',
    })
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(undefined)

    const result = await uninstallCommand('test-agent')

    expect(result.error?.code).toBe('UNINSTALL_UNMANAGED')
    expect(result.error?.details).toMatchObject({
      canAutoUninstall: false,
      displayName: 'Test Agent',
      input: 'test-agent',
      lifecycle: 'unmanaged',
      name: 'test-agent',
    })
    expect(uninstallSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('cannot auto-uninstall'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('qtx inspect test-agent'))
  })

  it('returns a stable conflict when another lifecycle operation already holds the lock', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    uninstallSpy.mockRejectedValue(new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock'))

    const result = await uninstallCommand('test-agent')

    expect(result.error?.code).toBe('RESOURCE_LOCKED')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('agent lifecycle lock'))
  })

  it('returns a dry-run plan without invoking uninstallAgent', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })

    const result = await uninstallCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data?.changed).toBe(false)
    expect(result.warnings[0]?.code).toBe('DRY_RUN')
    expect(uninstallSpy).not.toHaveBeenCalled()
  })

  it('returns the unmanaged error in dry-run mode when the agent has no managed installed state', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-unmanaged-id',
    })
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(undefined)

    const result = await uninstallCommand('test-agent')

    expect(result.error?.code).toBe('UNINSTALL_UNMANAGED')
    expect(uninstallSpy).not.toHaveBeenCalled()
  })
})
