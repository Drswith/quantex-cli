import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import { uninstallCommand } from '../../src/commands/uninstall'
import * as providerEvidence from '../../src/lifecycle/provider-evidence'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import { ResourceLockError } from '../../src/utils/lock'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const uninstallSpy = adaptLegacyUninstallSpy(vi.spyOn(pm, 'uninstallInstalledAgentOutcome'))
const lifecycleLockSpy = vi.spyOn(pm, 'withAgentLifecycleLock')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const getReceiptSpy = vi.spyOn(state, 'getLifecycleReceipt')
const removeReceiptSpy = vi.spyOn(state, 'removeLifecycleReceipt')
const setInstalledStateSpy = vi.spyOn(state, 'setInstalledAgentState')
const setReceiptSpy = vi.spyOn(state, 'setLifecycleReceipt')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const observeProviderSpy = vi.spyOn(providerEvidence, 'observeLifecycleProvider')

afterAll(() => {
  agentSpy.mockRestore()
  uninstallSpy.mockRestore()
  lifecycleLockSpy.mockRestore()
  installedStateSpy.mockRestore()
  getReceiptSpy.mockRestore()
  removeReceiptSpy.mockRestore()
  setInstalledStateSpy.mockRestore()
  setReceiptSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  observeProviderSpy.mockRestore()
})

function adaptLegacyUninstallSpy(spy: any): any {
  const mockResolvedValue = spy.mockResolvedValue.bind(spy)
  const mockImplementation = spy.mockImplementation.bind(spy)
  spy.mockResolvedValue = (value: any) => mockResolvedValue(toTypedUninstallOutcome(value))
  spy.mockImplementation = (implementation: (...args: any[]) => Promise<any>) =>
    mockImplementation(async (...args: any[]) => toTypedUninstallOutcome(await implementation(...args)))
  return spy
}

function toTypedUninstallOutcome(value: any): any {
  if (value?.kind) return value
  return value ? { kind: 'success', value: {} } : { kind: 'failed', reason: 'uninstall-failed', retryable: false }
}

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
    uninstallSpy.mockReset()
    lifecycleLockSpy.mockReset()
    lifecycleLockSpy.mockImplementation(async run => run())
    installedStateSpy.mockClear()
    getReceiptSpy.mockReset()
    getReceiptSpy.mockResolvedValue(undefined)
    removeReceiptSpy.mockReset()
    removeReceiptSpy.mockResolvedValue()
    setInstalledStateSpy.mockReset()
    setInstalledStateSpy.mockResolvedValue()
    setReceiptSpy.mockReset()
    setReceiptSpy.mockResolvedValue()
    binaryInPathSpy.mockReset()
    binaryInPathSpy.mockResolvedValue(false)
    observeProviderSpy.mockReset()
    observeProviderSpy.mockImplementation(async binding => ({
      kind: 'success',
      value: { kind: 'present', target: binding.target },
    }))
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
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    observeProviderSpy
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'present', target: binding.target },
      }))
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'absent', target: binding.target },
      }))
    uninstallSpy.mockResolvedValue(true)
    await uninstallCommand('test-agent')
    expect(uninstallSpy).toHaveBeenCalledWith(testAgent, managedInstalledState)
    expect(removeReceiptSpy).toHaveBeenCalledWith('test-agent')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('uninstalled successfully'))
  })

  it('waits for provider and PATH removal evidence to converge', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    observeProviderSpy
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'present', target: binding.target },
      }))
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'present', target: binding.target },
      }))
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'absent', target: binding.target },
      }))
    uninstallSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(observeProviderSpy).toHaveBeenCalledTimes(3)
    expect(binaryInPathSpy).toHaveBeenCalledTimes(2)
    expect(removeReceiptSpy).toHaveBeenCalledWith('test-agent')
  })

  it('stops postcondition polling on live CLI cancellation and retains evidence', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValue(true)
    uninstallSpy.mockResolvedValue(true)

    const resultPromise = uninstallCommand('test-agent')
    await vi.waitFor(() => expect(observeProviderSpy).toHaveBeenCalledTimes(2))
    await cancelCliContextOperations()
    const result = await resultPromise

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(observeProviderSpy).toHaveBeenCalledTimes(2)
    expect(removeReceiptSpy).not.toHaveBeenCalled()
    expect(setInstalledStateSpy).toHaveBeenCalledWith(managedInstalledState)
  })

  it('shows failure message', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValue(true)
    uninstallSpy.mockResolvedValue(false)
    const result = await uninstallCommand('test-agent')
    expect(result.error?.code).toBe('UNINSTALL_FAILED')
    expect(result.error?.details).toMatchObject({ lifecycle: 'provider-failure' })
    expect(removeReceiptSpy).not.toHaveBeenCalled()
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
    lifecycleLockSpy.mockRejectedValue(new ResourceLockError('agent lifecycle', '/tmp/agent-lifecycle.lock'))

    const result = await uninstallCommand('test-agent')

    expect(result.error?.code).toBe('RESOURCE_LOCKED')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('agent lifecycle lock'))
  })

  it('observes state and removes the exact binding under one lifecycle lock', async () => {
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
    installedStateSpy.mockImplementation(async () => {
      expect(insideLifecycleLock).toBe(true)
      return managedInstalledState
    })
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    observeProviderSpy
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'present', target: binding.target },
      }))
      .mockImplementationOnce(async binding => ({
        kind: 'success',
        value: { kind: 'absent', target: binding.target },
      }))
    uninstallSpy.mockImplementation(async (_agent: AgentDefinition, installedState: InstalledAgentState) => {
      expect(insideLifecycleLock).toBe(true)
      expect(installedState).toEqual(managedInstalledState)
      return true
    })

    const result = await uninstallCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(lifecycleLockSpy).toHaveBeenCalledOnce()
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

  it('clears a conclusive ghost receipt without invoking provider removal', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(undefined)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValue(false)
    observeProviderSpy.mockImplementation(async binding => ({
      kind: 'success',
      value: { kind: 'absent', target: binding.target },
    }))

    const result = await uninstallCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.warnings[0]).toMatchObject({ code: 'GHOST_STATE_RECONCILED' })
    expect(uninstallSpy).not.toHaveBeenCalled()
    expect(removeReceiptSpy).toHaveBeenCalledWith('test-agent')
  })

  it('retains a receipt when PATH is absent but the bound provider target remains present', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(undefined)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValue(false)

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'indeterminate-source' },
    })
    expect(uninstallSpy).not.toHaveBeenCalled()
    expect(removeReceiptSpy).not.toHaveBeenCalled()
  })

  it('does not let an unverified legacy state authorize provider removal', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue(undefined)
    binaryInPathSpy.mockResolvedValue(true)
    observeProviderSpy.mockImplementation(async binding => ({
      kind: 'success',
      value: { kind: 'absent', target: binding.target },
    }))

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'conflicting-source' },
    })
    expect(uninstallSpy).not.toHaveBeenCalled()
  })

  it('retains evidence when provider post-verification still reports present', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    uninstallSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(removeReceiptSpy).not.toHaveBeenCalled()
    expect(setInstalledStateSpy).toHaveBeenCalledWith(managedInstalledState)
  })

  it('rejects conflicting receipt and installed provider evidence', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue({
      ...managedReceipt,
      providerId: 'npm',
      providerTargetId: 'other-pkg',
    })
    binaryInPathSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'conflicting-source' },
    })
    expect(uninstallSpy).not.toHaveBeenCalled()
    expect(removeReceiptSpy).not.toHaveBeenCalled()
  })

  it('rejects a Brew receipt whose target kind differs from installed state', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'brew',
      packageName: 'test-pkg',
      packageTargetKind: 'cask',
    })
    getReceiptSpy.mockResolvedValue({
      ...managedReceipt,
      providerId: 'brew',
      providerTargetKind: 'formula',
    })
    binaryInPathSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'conflicting-source' },
    })
    expect(uninstallSpy).not.toHaveBeenCalled()
  })

  it('rejects install-effect evidence with a conflicting executable identity', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      command: 'curl https://example.com/install | sh',
      installType: 'script',
    })
    getReceiptSpy.mockResolvedValue({
      ...managedReceipt,
      executableName: 'different-bin',
      providerId: 'script',
      providerTargetId: 'curl https://example.com/install | sh',
      providerTargetKind: 'script',
    })

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'conflicting-source' },
    })
    expect(uninstallSpy).not.toHaveBeenCalled()
  })

  it('retains source evidence when post-uninstall verification fails', async () => {
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(managedInstalledState)
    getReceiptSpy.mockResolvedValue(managedReceipt)
    binaryInPathSpy.mockResolvedValue(true)
    uninstallSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.error).toMatchObject({
      code: 'UNINSTALL_FAILED',
      details: { lifecycle: 'verification-failed' },
    })
    expect(removeReceiptSpy).not.toHaveBeenCalled()
    expect(setInstalledStateSpy).toHaveBeenCalledWith(managedInstalledState)
  })

  it('untracks a script install without requiring PATH absence', async () => {
    const scriptInstalledState = {
      agentName: 'test-agent',
      binaryName: 'test-bin',
      command: 'curl https://example.com/install | sh',
      installType: 'script' as const,
    }
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(scriptInstalledState)
    getReceiptSpy.mockResolvedValue(undefined)
    binaryInPathSpy.mockResolvedValue(true)
    uninstallSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      agent: { name: 'test-agent' },
      changed: true,
    })
    expect(uninstallSpy).toHaveBeenCalledWith(testAgent, scriptInstalledState)
    expect(setReceiptSpy).not.toHaveBeenCalled()
    expect(setInstalledStateSpy).not.toHaveBeenCalled()
    expect(removeReceiptSpy).toHaveBeenCalledWith('test-agent')
    expect(binaryInPathSpy).toHaveBeenCalledTimes(1)
  })

  it('untracks a binary install without requiring PATH absence', async () => {
    const binaryInstalledState = {
      agentName: 'test-agent',
      binaryName: 'test-bin',
      installType: 'binary' as const,
    }
    agentSpy.mockReturnValue(testAgent)
    installedStateSpy.mockResolvedValue(binaryInstalledState)
    getReceiptSpy.mockResolvedValue({
      executableName: 'test-bin',
      kind: 'lifecycle-receipt' as const,
      providerId: 'binary',
      providerTargetId: 'test-bin',
      providerTargetKind: 'binary' as const,
      schemaVersion: 1,
      targetId: 'test-agent',
      verifiedAt: '2026-07-12T03:00:00.000Z',
    })
    binaryInPathSpy.mockResolvedValue(true)
    uninstallSpy.mockResolvedValue(true)

    const result = await uninstallCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      agent: { name: 'test-agent' },
      changed: true,
    })
    expect(uninstallSpy).toHaveBeenCalledWith(testAgent, binaryInstalledState)
    expect(setReceiptSpy).not.toHaveBeenCalled()
    expect(setInstalledStateSpy).not.toHaveBeenCalled()
    expect(removeReceiptSpy).toHaveBeenCalledWith('test-agent')
  })
})

const managedReceipt = {
  kind: 'lifecycle-receipt' as const,
  providerId: 'bun',
  providerTargetId: 'test-pkg',
  schemaVersion: 1,
  targetId: 'test-agent',
  verifiedAt: '2026-07-12T03:00:00.000Z',
}
import type { AgentDefinition } from '../../src/agents'
import type { InstalledAgentState } from '../../src/state'
