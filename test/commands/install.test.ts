import type { AgentDefinition } from '../../src/agents'
import process from 'node:process'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
import { installCommand } from '../../src/commands/install'
import * as providerEvidence from '../../src/lifecycle/provider-evidence'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import { ResourceLockError } from '../../src/utils/lock'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = vi.spyOn(pm, 'installAgent')
const reinstallSpy = vi.spyOn(pm, 'reinstallInstalledAgent')
const trackSpy = vi.spyOn(pm, 'trackInstalledAgent')
const lifecycleLockSpy = vi.spyOn(pm, 'withAgentLifecycleLock')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const removeInstalledStateSpy = vi.spyOn(state, 'removeInstalledAgentState')
const setReceiptSpy = vi.spyOn(state, 'setLifecycleReceipt')
const observeProviderSpy = vi.spyOn(providerEvidence, 'observeLifecycleProvider')

afterAll(() => {
  agentSpy.mockRestore()
  installSpy.mockRestore()
  reinstallSpy.mockRestore()
  trackSpy.mockRestore()
  lifecycleLockSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedStateSpy.mockRestore()
  removeInstalledStateSpy.mockRestore()
  setReceiptSpy.mockRestore()
  observeProviderSpy.mockRestore()
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

const anotherAgent = {
  ...testAgent,
  name: 'another-agent',
  displayName: 'Another Agent',
  binaryName: 'another-bin',
  packages: { npm: 'another-pkg' },
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

describe('installCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    installSpy.mockClear()
    reinstallSpy.mockReset()
    reinstallSpy.mockImplementation(async (_agent, installedState) => ({ installedState, success: true }))
    trackSpy.mockClear()
    lifecycleLockSpy.mockReset()
    lifecycleLockSpy.mockImplementation(async run => run())
    binaryInPathSpy.mockReset()
    installedStateSpy.mockClear()
    removeInstalledStateSpy.mockReset()
    removeInstalledStateSpy.mockResolvedValue()
    setReceiptSpy.mockReset()
    setReceiptSpy.mockResolvedValue()
    observeProviderSpy.mockReset()
    observeProviderSpy.mockImplementation(async binding => ({
      kind: 'success',
      value: {
        executablePath: `/bin/${binding.target.id}`,
        kind: 'present',
        target: binding.target,
        version: '1.2.3',
      },
    }))
    installedStateSpy.mockResolvedValue(undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await installCommand('unknown')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
    expect(lifecycleLockSpy).not.toHaveBeenCalled()
  })

  it('shows already installed when a tracked install exists', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })

    await installCommand('test-agent')

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
    expect(installSpy).not.toHaveBeenCalled()
    expect(trackSpy).not.toHaveBeenCalled()
  })

  it('tracks an existing script install when the source is unambiguous', async () => {
    agentSpy.mockReturnValue(scriptOnlyAgent)
    binaryInPathSpy.mockResolvedValue(true)
    trackSpy.mockResolvedValue({
      agentName: 'script-agent',
      installType: 'script',
      command: expectedScriptInstallCommand,
    })

    await installCommand('script-agent')

    expect(trackSpy).toHaveBeenCalledWith(
      scriptOnlyAgent,
      expect.objectContaining({
        command: expectedScriptInstallCommand,
        type: 'script',
      }),
    )
    expect(installSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Quantex is now tracking the existing install'))
  })

  it('explains when an existing install remains untracked', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)

    await installCommand('test-agent')

    expect(trackSpy).not.toHaveBeenCalled()
    expect(installSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('not tracked by Quantex'))
  })

  it('calls installAgent and shows success', async () => {
    agentSpy.mockReturnValue(testAgent)
    mockMissingThenVerified(binaryInPathSpy)
    installSpy.mockResolvedValue(successfulInstall(testAgent))
    await installCommand('test-agent')
    expect(installSpy).toHaveBeenCalledWith(testAgent)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('installed successfully'))
  })

  it('records a receipt only after the installed binary is verified', async () => {
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

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(setReceiptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'bun',
        providerTargetId: 'test-pkg',
        targetId: 'test-agent',
      }),
    )
  })

  it('returns a typed partial failure and preserves source evidence when verification fails', async () => {
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

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({
      code: 'INSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(setReceiptSpy).not.toHaveBeenCalled()
    expect(removeInstalledStateSpy).not.toHaveBeenCalled()
  })

  it('reinstalls a tracked ghost instead of treating stale state as satisfied', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
    })
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

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(reinstallSpy).toHaveBeenCalledWith(
      testAgent,
      expect.objectContaining({ installType: 'bun', packageName: 'test-pkg' }),
    )
    expect(installSpy).not.toHaveBeenCalled()
  })

  it('shows failure message when installAgent returns false', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: false })
    await installCommand('test-agent')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
  })

  it('returns a stable conflict when another lifecycle operation already holds the lock', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockRejectedValue(new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock'))

    const result = await installCommand('test-agent')

    expect(result.error?.code).toBe('RESOURCE_LOCKED')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('agent lifecycle lock'))
  })

  it('returns a dry-run plan without invoking installAgent', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data?.changed).toBe(false)
    expect(result.warnings[0]?.code).toBe('DRY_RUN')
    expect(installSpy).not.toHaveBeenCalled()
    expect(lifecycleLockSpy).not.toHaveBeenCalled()
  })

  it('suppresses informational success logs in quiet mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      quiet: true,
      runId: 'quiet-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    mockMissingThenVerified(binaryInPathSpy)
    installSpy.mockResolvedValue(successfulInstall(testAgent))

    await installCommand('test-agent')

    expect(stdoutWriteSpy).not.toHaveBeenCalled()
  })

  it('emits a structured result in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'test-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    mockMissingThenVerified(binaryInPathSpy)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })

    await installCommand('test-agent')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('install')
    expect(payload.data.agent.name).toBe('test-agent')
    expect(payload.data.changed).toBe(true)
    expect(payload.meta.runId).toBe('test-run-id')
    expect(payload.meta.schemaVersion).toBe('1')
  })

  it('emits ndjson lifecycle events when requested', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'test-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    mockMissingThenVerified(binaryInPathSpy)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })

    await installCommand('test-agent')

    const startedEvent = JSON.parse(logSpy.mock.calls[0][0])
    const resultEvent = JSON.parse(logSpy.mock.calls[1][0])
    expect(startedEvent.type).toBe('started')
    expect(startedEvent.action).toBe('install')
    expect(resultEvent.type).toBe('result')
    expect(resultEvent.data.ok).toBe(true)
    expect(resultEvent.meta.mode).toBe('ndjson')
  })

  it('installs multiple agents sequentially and prints a batch summary', async () => {
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      if (name === 'another-agent') return anotherAgent
      return undefined
    })
    mockMissingThenVerified(binaryInPathSpy, 2)
    installSpy.mockImplementation(async agent => successfulInstall(agent))

    const result = await installCommand(['test-agent', 'another-agent'])

    expect(result.ok).toBe(true)
    expect(installSpy).toHaveBeenNthCalledWith(1, anotherAgent)
    expect(installSpy).toHaveBeenNthCalledWith(2, testAgent)

    const output = stdoutWriteSpy.mock.calls.map((call: any[]) => call[0]).join('\n')
    expect(output).toContain('Test Agent installed successfully')
    expect(output).toContain('Another Agent installed successfully')
    expect(output).toContain('Summary: installed 2')
  })

  it('normalizes aliases, removes duplicates, and executes batch targets in canonical order', async () => {
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent' || name === 'ta') return testAgent
      if (name === 'another-agent' || name === 'aa') return anotherAgent
      return undefined
    })
    mockMissingThenVerified(binaryInPathSpy, 2)
    installSpy.mockImplementation(async agent => successfulInstall(agent))

    const result = await installCommand(['ta', 'another-agent', 'test-agent', 'aa'])

    expect(installSpy).toHaveBeenCalledTimes(2)
    expect(installSpy).toHaveBeenNthCalledWith(1, anotherAgent)
    expect(installSpy).toHaveBeenNthCalledWith(2, testAgent)
    expect(result.data).toMatchObject({
      results: [
        { agent: { name: 'another-agent' }, input: 'another-agent' },
        { agent: { name: 'test-agent' }, input: 'test-agent' },
      ],
      scope: 'batch',
    })
  })

  it('continues after a batch failure and returns aggregated json output', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-run-id',
    })
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      return undefined
    })
    mockMissingThenVerified(binaryInPathSpy)
    installSpy.mockResolvedValue(successfulInstall(testAgent))

    const result = await installCommand(['test-agent', 'unknown'])

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INSTALL_FAILED')

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.data.scope).toBe('batch')
    expect(payload.data.results).toHaveLength(2)
    expect(payload.data.results[0]).toMatchObject({
      input: 'test-agent',
      ok: true,
      status: 'installed',
    })
    expect(payload.data.results[1]).toMatchObject({
      input: 'unknown',
      ok: false,
      status: 'failed',
    })
    expect(payload.meta.runId).toBe('batch-run-id')
  })

  it('emits ndjson batch progress events for multi-agent installs', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'batch-ndjson-run-id',
    })
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      if (name === 'another-agent') return anotherAgent
      return undefined
    })
    mockMissingThenVerified(binaryInPathSpy, 2)
    installSpy.mockImplementation(async agent => successfulInstall(agent))

    await installCommand(['test-agent', 'another-agent'])

    const startedEvent = JSON.parse(logSpy.mock.calls[0][0])
    const firstProgressEvent = JSON.parse(logSpy.mock.calls[1][0])
    const secondProgressEvent = JSON.parse(logSpy.mock.calls[2][0])
    const resultEvent = JSON.parse(logSpy.mock.calls[3][0])

    expect(startedEvent.type).toBe('started')
    expect(startedEvent.data.scope).toBe('batch')
    expect(firstProgressEvent.type).toBe('progress')
    expect(firstProgressEvent.data.agent.name).toBe('another-agent')
    expect(secondProgressEvent.type).toBe('progress')
    expect(secondProgressEvent.data.agent.name).toBe('test-agent')
    expect(resultEvent.type).toBe('result')
    expect(resultEvent.data.data.scope).toBe('batch')
    expect(resultEvent.meta.runId).toBe('batch-ndjson-run-id')
  })

  it('stops batch install when the cli context is cancelled', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-cancel-run',
    })
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      if (name === 'another-agent') return anotherAgent
      return undefined
    })
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockImplementation(async agent => {
      if (agent.name === 'another-agent') {
        await cancelCliContextOperations()
        return { success: false }
      }

      return { success: true }
    })

    await installCommand(['test-agent', 'another-agent'])

    expect(installSpy).toHaveBeenCalledTimes(1)
    expect(installSpy).toHaveBeenCalledWith(anotherAgent)
  })

  it('does not report overall success for batch install after cancellation', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-install-cancel-success-run',
    })
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      if (name === 'another-agent') return anotherAgent
      return undefined
    })
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockImplementation(async agent => {
      if (agent.name === 'another-agent') {
        await cancelCliContextOperations()
        return {
          success: true,
          installedState: {
            agentName: 'another-agent',
            installType: 'bun',
            packageName: 'another-pkg',
          },
        }
      }

      return { success: true }
    })

    const result = await installCommand(['test-agent', 'another-agent'])

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CANCELLED')
    expect(installSpy).toHaveBeenCalledTimes(1)
    expect(installSpy).toHaveBeenCalledWith(anotherAgent)
  })

  it('does not install remaining batch agents after timeout cancellation', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-timeout-run',
      timeoutMs: 50,
    })
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      if (name === 'another-agent') return anotherAgent
      return undefined
    })
    binaryInPathSpy.mockResolvedValue(false)
    let markInstallStarted!: () => void
    let releaseInstall!: () => void
    let lateCommand!: ReturnType<typeof installCommand>
    const installStarted = new Promise<void>(resolve => {
      markInstallStarted = resolve
    })
    const installRelease = new Promise<void>(resolve => {
      releaseInstall = resolve
    })
    installSpy.mockImplementation(async agent => {
      if (agent.name === 'another-agent') {
        markInstallStarted()
        await installRelease
        return { success: false }
      }

      return { success: true }
    })

    const runtimePromise = executeCommandWithRuntime({
      action: 'install',
      run: () => {
        lateCommand = installCommand(['test-agent', 'another-agent'])
        return lateCommand
      },
      target: {
        kind: 'agent',
        name: 'another-agent,test-agent',
      },
    })

    await installStarted
    const runtimeResult = await runtimePromise
    releaseInstall()
    await lateCommand

    expect(runtimeResult.error?.code).toBe('TIMEOUT')
    expect(installSpy).toHaveBeenCalledTimes(1)
    expect(installSpy).toHaveBeenCalledWith(anotherAgent)
  })

  it('does not report overall success for batch install after timeout cancellation', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'batch-install-timeout-success-run',
      timeoutMs: 50,
    })
    agentSpy.mockImplementation((name: string) => {
      if (name === 'test-agent') return testAgent
      if (name === 'another-agent') return anotherAgent
      return undefined
    })
    binaryInPathSpy.mockResolvedValue(false)
    let markInstallStarted!: () => void
    let releaseInstall!: () => void
    const installStarted = new Promise<void>(resolve => {
      markInstallStarted = resolve
    })
    const installRelease = new Promise<void>(resolve => {
      releaseInstall = resolve
    })
    let lateCommand!: ReturnType<typeof installCommand>
    installSpy.mockImplementation(async agent => {
      if (agent.name === 'another-agent') {
        markInstallStarted()
        await installRelease
        return {
          success: true,
          installedState: {
            agentName: 'another-agent',
            installType: 'bun',
            packageName: 'another-pkg',
          },
        }
      }

      return { success: true }
    })

    const runtimePromise = executeCommandWithRuntime({
      action: 'install',
      run: () => {
        lateCommand = installCommand(['test-agent', 'another-agent'])
        return lateCommand
      },
      target: {
        kind: 'agent',
        name: 'another-agent,test-agent',
      },
    })

    await installStarted
    const runtimeResult = await runtimePromise
    releaseInstall()
    await lateCommand

    expect(runtimeResult.ok).toBe(false)
    expect(['CANCELLED', 'TIMEOUT']).toContain(runtimeResult.error?.code)
    expect(installSpy).toHaveBeenCalledTimes(1)
    expect(installSpy).toHaveBeenCalledWith(anotherAgent)
  })
})

function successfulInstall(agent: AgentDefinition) {
  return {
    installedState: {
      agentName: agent.name,
      installType: 'bun' as const,
      packageName: agent.packages?.npm,
    },
    success: true,
  }
}

function mockMissingThenVerified(spy: typeof binaryInPathSpy, count = 1): void {
  for (let index = 0; index < count; index += 1) {
    spy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  }
}
