import type { AgentDefinition } from '../../src/agents'
import type { InstalledAgentState } from '../../src/state'
import process from 'node:process'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { resetCliContext, setCliContext } from '../../src/cli-context'
import { ensureCommand } from '../../src/commands/ensure'
import * as providerEvidence from '../../src/lifecycle/provider-evidence'
import * as pm from '../../src/package-manager'
import * as lifecycleObservations from '../../src/services/lifecycle-observations'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'

const typedMutationSpies: Array<{ mockRestore(): void }> = []
const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = adaptLegacyMutationSpy(vi.spyOn(pm, 'installAgentOutcome'))
const reinstallSpy = adaptLegacyMutationSpy(vi.spyOn(pm, 'reinstallInstalledAgentOutcome'))
const rollbackInstallSpy = vi.spyOn(pm, 'rollbackInstalledAgentInstallation')
const trackSpy = vi.spyOn(pm, 'trackInstalledAgent')
const lifecycleLockSpy = vi.spyOn(pm, 'withAgentLifecycleLock')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const removeInstalledStateSpy = vi.spyOn(state, 'removeInstalledAgentState')
const setReceiptSpy = vi.spyOn(state, 'setAgentLifecycleEvidence')
const observeProviderSpy = vi.spyOn(providerEvidence, 'observeLifecycleProvider')
const resolveObservationSpy = vi.spyOn(lifecycleObservations, 'resolveAgentObservation')

afterAll(() => {
  agentSpy.mockRestore()
  installSpy.mockRestore()
  reinstallSpy.mockRestore()
  rollbackInstallSpy.mockRestore()
  trackSpy.mockRestore()
  lifecycleLockSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedStateSpy.mockRestore()
  removeInstalledStateSpy.mockRestore()
  setReceiptSpy.mockRestore()
  observeProviderSpy.mockRestore()
  resolveObservationSpy.mockRestore()
  for (const spy of typedMutationSpies) spy.mockRestore()
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

const scriptOnlyAgent = {
  ...testAgent,
  name: 'script-agent',
  displayName: 'Script Agent',
  binaryName: 'script-bin',
  packages: undefined,
  selfUpdate: {
    command: ['script-bin', 'update'],
  },
  platforms: {
    linux: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
    macos: [{ type: 'script' as const, command: 'curl https://example.com/install | bash' }],
    windows: [{ type: 'script' as const, command: 'irm https://example.com/install | iex' }],
  },
}

const expectedScriptInstallCommand =
  process.platform === 'win32'
    ? scriptOnlyAgent.platforms.windows[0].command
    : scriptOnlyAgent.platforms.macos[0].command

describe('ensureCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    installSpy.mockClear()
    reinstallSpy.mockReset()
    reinstallSpy.mockImplementation(async (_agent: AgentDefinition, installedState: InstalledAgentState) => ({
      installedState,
      success: true,
    }))
    rollbackInstallSpy.mockReset()
    rollbackInstallSpy.mockResolvedValue()
    trackSpy.mockClear()
    lifecycleLockSpy.mockReset()
    lifecycleLockSpy.mockImplementation(async run => run())
    binaryInPathSpy.mockClear()
    installedStateSpy.mockClear()
    removeInstalledStateSpy.mockReset()
    removeInstalledStateSpy.mockResolvedValue()
    setReceiptSpy.mockReset()
    setReceiptSpy.mockResolvedValue()
    observeProviderSpy.mockReset()
    observeProviderSpy.mockImplementation(async binding => ({
      kind: 'success',
      value: {
        executablePath: '/bin/test-bin',
        kind: 'present',
        target: binding.target,
        version: '1.2.3',
      },
    }))
    installedStateSpy.mockResolvedValue(undefined)
    resolveObservationSpy.mockImplementation(resolveObservedAgent)
  })

  afterEach(() => {
    resetCliContext()
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await ensureCommand('unknown')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
    expect(lifecycleLockSpy).not.toHaveBeenCalled()
  })

  it('returns already installed without reinstalling when state is already tracked', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })

    await ensureCommand('test-agent')

    expect(installSpy).not.toHaveBeenCalled()
    expect(trackSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
  })

  it('does not backfill a receipt for an already tracked agent during dry run', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'ensure-dry-run',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data?.changed).toBe(false)
    expect(setReceiptSpy).not.toHaveBeenCalled()
    expect(lifecycleLockSpy).not.toHaveBeenCalled()
  })

  it('keeps tracked-ghost dry-run conditional without acquiring the lifecycle lock', async () => {
    setCliContext({ dryRun: true, interactive: false, outputMode: 'json', runId: 'ghost-dry-run' })
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    binaryInPathSpy.mockResolvedValue(false)

    const result = await ensureCommand('test-agent')

    expect(result.warnings[0]?.message).toContain('only if its recorded provider target is confirmed absent')
    expect(lifecycleLockSpy).not.toHaveBeenCalled()
    expect(observeProviderSpy).not.toHaveBeenCalled()
  })

  it('tracks an existing script install when ensure can identify the source safely', async () => {
    agentSpy.mockReturnValue(scriptOnlyAgent)
    binaryInPathSpy.mockResolvedValue(true)
    await ensureCommand('script-agent')

    expect(trackSpy).not.toHaveBeenCalled()
    expect(setReceiptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expectedScriptInstallCommand,
        installType: 'script',
      }),
      expect.objectContaining({ targetId: 'script-agent' }),
    )
    expect(installSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Quantex is now tracking the existing install'))
  })

  it('explains when an existing install stays untracked', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)

    await ensureCommand('test-agent')

    expect(trackSpy).not.toHaveBeenCalled()
    expect(installSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('not tracked by Quantex'))
  })

  it('installs the agent when missing', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })

    await ensureCommand('test-agent')

    expect(installSpy).toHaveBeenCalledWith(testAgent, [expect.objectContaining({ type: 'bun' })])
    expect(setReceiptSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: 'test-agent', installType: 'bun' }),
      expect.objectContaining({
        kind: 'lifecycle-receipt',
        providerId: 'bun',
        providerTargetId: 'test-pkg',
        targetId: 'test-agent',
        version: '1.2.3',
      }),
    )
    const output = stdoutWriteSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Installing Test Agent')
    expect(output).toContain('now installed')
  })

  it('emits structured output in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'ensure-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })

    await ensureCommand('test-agent')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('ensure')
    expect(payload.data.changed).toBe(true)
    expect(payload.data.installed).toBe(true)
    expect(payload.meta.runId).toBe('ensure-run-id')
  })

  it('does not report installation success when the live postcondition is unsatisfied', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({
      code: 'INSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(setReceiptSpy).not.toHaveBeenCalled()
    expect(removeInstalledStateSpy).not.toHaveBeenCalled()
  })

  it('rejects a same-name executable when the bound provider target is absent', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })
    observeProviderSpy.mockImplementation(async binding => ({
      kind: 'success',
      value: {
        kind: 'absent',
        target: binding.target,
      },
    }))

    const result = await ensureCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'INSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(setReceiptSpy).not.toHaveBeenCalled()
    expect(removeInstalledStateSpy).not.toHaveBeenCalled()
  })

  it('does not report success when the verified receipt cannot be persisted', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })
    setReceiptSpy.mockRejectedValue(new Error('disk-full'))

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({
      code: 'INSTALL_FAILED',
      details: { lifecycle: 'state-write-failed' },
    })
    expect(removeInstalledStateSpy).not.toHaveBeenCalled()
    expect(rollbackInstallSpy).toHaveBeenCalledWith(
      testAgent,
      expect.objectContaining({ agentName: 'test-agent', installType: 'bun' }),
    )
  })

  it('does not treat PATH presence as exact script provider evidence', async () => {
    agentSpy.mockReturnValue(scriptOnlyAgent)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'script-agent',
        command: expectedScriptInstallCommand,
        installType: 'script',
      },
      success: true,
    })
    observeProviderSpy.mockResolvedValue({
      kind: 'indeterminate',
      reason: 'script presence unknown',
    })

    const result = await ensureCommand('script-agent')

    expect(result.error).toMatchObject({
      code: 'INSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(setReceiptSpy).not.toHaveBeenCalled()
  })

  it('keeps execution, verification, and receipt recording under one lifecycle lock', async () => {
    let insideLifecycleLock = false
    lifecycleLockSpy.mockImplementation(async run => {
      insideLifecycleLock = true
      try {
        return await run()
      } finally {
        insideLifecycleLock = false
      }
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    installSpy.mockResolvedValue({
      installedState: managedInstalledState,
      success: true,
    })
    setReceiptSpy.mockImplementation(async () => {
      expect(insideLifecycleLock).toBe(true)
    })

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(lifecycleLockSpy).toHaveBeenCalledTimes(2)
  })

  it('reinstalls a tracked ghost instead of repeatedly verifying stale state', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    binaryInPathSpy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    observeProviderSpy
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'absent', target: binding.target },
      }))
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'present', target: binding.target },
      }))

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(reinstallSpy).toHaveBeenCalledWith(testAgent, managedInstalledState)
    expect(installSpy).not.toHaveBeenCalled()
  })

  it('does not reinstall when only PATH evidence is absent', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    binaryInPathSpy.mockResolvedValue(false)

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(false)
    expect(reinstallSpy).not.toHaveBeenCalled()
    expect(installSpy).not.toHaveBeenCalled()
  })
})

async function resolveObservedAgent(agentName: string) {
  const agent = agents.getAgentByNameOrAlias(agentName)
  if (!agent) return undefined
  const [inPath, installedState] = await Promise.all([
    detect.isBinaryInPath(agent.binaryName),
    state.getInstalledAgentState(agent.name),
  ])
  const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
  const methods = agent.platforms[platform] ?? []
  return {
    agent,
    capabilities: [],
    catalogMethods: [],
    executable: inPath ? { present: true as const } : { present: false as const },
    installedState,
    methods,
    observation: inPath
      ? {
          drift: { kind: installedState ? ('none' as const) : ('untracked' as const) },
          kind: 'present' as const,
          targetId: agent.name,
        }
      : {
          drift: { kind: installedState ? ('recorded-absent' as const) : ('none' as const) },
          kind: 'absent' as const,
          targetId: agent.name,
        },
    pathExecutable: inPath ? { present: true as const } : { present: false as const },
  }
}

function adaptLegacyMutationSpy(spy: any): any {
  const compatibilitySpy = vi.fn()
  spy.mockImplementation(async (...args: any[]) => toTypedMutationOutcome(await compatibilitySpy(...args)))
  typedMutationSpies.push(spy)
  return compatibilitySpy
}

function toTypedMutationOutcome(value: any): any {
  if (value?.kind) return value
  return value?.success
    ? { kind: 'success', value: { installedState: value.installedState } }
    : { kind: 'failed', reason: 'operation-failed', retryable: false }
}

const managedInstalledState = {
  agentName: 'test-agent',
  installType: 'bun' as const,
  packageName: 'test-pkg',
}
