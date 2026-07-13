import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import * as commandRegistry from '../../src/command-contract/registry'
import { capabilitiesCommand } from '../../src/commands/capabilities'
import * as selfModule from '../../src/self'
import * as providerObservations from '../../src/services/provider-observations'
import * as detect from '../../src/utils/detect'

const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const isBunSpy = vi.spyOn(detect, 'isBunAvailable')
const isNpmSpy = vi.spyOn(detect, 'isNpmAvailable')
const isBrewSpy = vi.spyOn(detect, 'isBrewAvailable')
const isCargoSpy = vi.spyOn(detect, 'isCargoAvailable')
const isDenoSpy = vi.spyOn(detect, 'isDenoAvailable')
const isMiseSpy = vi.spyOn(detect, 'isMiseAvailable')
const isPipSpy = vi.spyOn(detect, 'isPipAvailable')
const isUvSpy = vi.spyOn(detect, 'isUvAvailable')
const isWingetSpy = vi.spyOn(detect, 'isWingetAvailable')
const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelfReadOnly')
const providerSnapshotSpy = vi.spyOn(providerObservations, 'observeProviderSnapshot')
const originalCommandContracts = commandRegistry.getCommandContracts()
const commandContractsSpy = vi.spyOn(commandRegistry, 'getCommandContracts')

afterAll(() => {
  allAgentsSpy.mockRestore()
  isBunSpy.mockRestore()
  isNpmSpy.mockRestore()
  isBrewSpy.mockRestore()
  isCargoSpy.mockRestore()
  isDenoSpy.mockRestore()
  isMiseSpy.mockRestore()
  isPipSpy.mockRestore()
  isUvSpy.mockRestore()
  isWingetSpy.mockRestore()
  inspectSelfSpy.mockRestore()
  providerSnapshotSpy.mockRestore()
  commandContractsSpy.mockRestore()
})

describe('capabilitiesCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    allAgentsSpy.mockClear()
    isBunSpy.mockClear()
    isNpmSpy.mockClear()
    isBrewSpy.mockClear()
    isCargoSpy.mockClear()
    isDenoSpy.mockClear()
    isMiseSpy.mockClear()
    isPipSpy.mockClear()
    isUvSpy.mockClear()
    isWingetSpy.mockClear()
    inspectSelfSpy.mockClear()
    providerSnapshotSpy.mockReset()
    commandContractsSpy.mockReset()
    commandContractsSpy.mockReturnValue(originalCommandContracts)
    allAgentsSpy.mockReturnValue([
      {
        binaryName: 'claude',
        displayName: 'Claude Code',
        homepage: 'https://example.com/claude',
        name: 'claude',
        platforms: { linux: [], macos: [], windows: [] },
      } as any,
      {
        binaryName: 'codex',
        displayName: 'Codex',
        homepage: 'https://example.com/codex',
        name: 'codex',
        platforms: { linux: [], macos: [], windows: [] },
      } as any,
    ])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.0.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })
    providerSnapshotSpy.mockResolvedValue(providerSnapshot())
    for (const directAvailabilitySpy of [
      isBunSpy,
      isNpmSpy,
      isBrewSpy,
      isCargoSpy,
      isDenoSpy,
      isMiseSpy,
      isPipSpy,
      isUvSpy,
      isWingetSpy,
    ]) {
      directAvailabilitySpy.mockRejectedValue(new Error('direct availability route used'))
    }
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows installer availability and feature summary', async () => {
    providerSnapshotSpy.mockResolvedValue(providerSnapshot({ bun: true, deno: true, npm: true }))

    await capabilitiesCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Quantex Capabilities')
    expect(output).toContain('Platform:')
    expect(output).toContain('Agents:')
    expect(output).toContain('--yes:')
    expect(output).toContain('dry-run:')
    expect(output).toContain('self-upgrade:')
    expect(output).toContain('exec-install-policy:')
  })

  it('emits structured capability data in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'cap-run-id',
    })
    providerSnapshotSpy.mockResolvedValue(
      providerSnapshot({ bun: true, cargo: true, deno: true, mise: true, npm: true, pip: true, uv: true }),
    )

    await capabilitiesCommand()

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('capabilities')
    expect(payload.data.agents).toEqual(['claude', 'codex'])
    expect(payload.data.features.execInstallPolicies).toEqual(['never', 'if-missing', 'always'])
    expect(payload.data.installers.cargo.available).toBe(true)
    expect(payload.data.installers.deno.available).toBe(true)
    expect(payload.data.installers.mise.available).toBe(true)
    expect(payload.data.installers.pip.available).toBe(true)
    expect(payload.data.installers.uv.available).toBe(true)
    expect(payload.data.features.cacheRefresh).toBe(true)
    expect(payload.data.features.cacheBypass).toBe(true)
    expect(payload.data.features.assumeYes).toBe(true)
    expect(payload.data.features.colorModes).toEqual(['auto', 'always', 'never'])
    expect(payload.data.features.freshnessMetadata).toBe(true)
    expect(payload.data.features.idempotencyKey).toBe(true)
    expect(payload.data.features.logLevels).toEqual(['silent', 'error', 'warn', 'info', 'debug'])
    expect(payload.data.features.quietLogs).toBe(true)
    expect(payload.data.features.timeout).toBe(true)
    expect(payload.data.features).toEqual({
      assumeYes: true,
      cacheBypass: true,
      cacheRefresh: true,
      channels: ['stable', 'beta'],
      colorModes: ['auto', 'always', 'never'],
      dryRun: true,
      execInstallPolicies: ['never', 'if-missing', 'always'],
      freshnessMetadata: true,
      idempotencyKey: true,
      logLevels: ['silent', 'error', 'warn', 'info', 'debug'],
      quietLogs: true,
      selfUpgrade: true,
      timeout: true,
    })
    expect(payload.data.outputModes).toEqual(['human', 'json', 'ndjson'])
    expect(Object.keys(payload.data.installers)).toEqual([
      'brew',
      'bun',
      'cargo',
      'deno',
      'mise',
      'npm',
      'pip',
      'uv',
      'winget',
    ])
    expect(payload.data.installers.brew.reason).toBe(process.platform === 'win32' ? 'not-on-platform' : 'not-found')
    expect(payload.data.installers.winget.reason).toBe(process.platform === 'win32' ? 'not-found' : 'not-on-platform')
    expect(payload.data.features.selfUpgrade).toBe(true)
    expect(payload.meta.runId).toBe('cap-run-id')
    expect(providerSnapshotSpy).toHaveBeenCalledTimes(1)
    expect(inspectSelfSpy).toHaveBeenCalledTimes(1)
  })

  it('derives v1 feature support from command registry flags and effects', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'cap-registry-run-id' })
    commandContractsSpy.mockReturnValue(
      originalCommandContracts.map(contract => ({
        ...contract,
        effects:
          contract.name === 'upgrade'
            ? contract.effects.filter(effect => effect !== 'mutation' && effect !== 'network')
            : contract.effects,
        flags: contract.flags.filter(flag => flag !== '--yes' && flag !== '--refresh'),
      })),
    )

    const result = await capabilitiesCommand()

    expect(result.data?.features.assumeYes).toBe(false)
    expect(result.data?.features.cacheRefresh).toBe(false)
    expect(result.data?.features.selfUpgrade).toBe(false)
    expect(commandContractsSpy).toHaveBeenCalledTimes(1)
  })
})

function providerSnapshot(available: Partial<Record<string, boolean>> = {}) {
  return ['bun', 'npm', 'brew', 'cargo', 'deno', 'mise', 'pip', 'uv', 'winget', 'script', 'binary'].map(id => ({
    availability: available[id]
      ? { kind: 'success' as const, value: { executable: id } }
      : { kind: 'unavailable' as const, reason: `${id} unavailable` },
    capabilities: ['availability', 'observe'] as const,
    id: id as any,
  }))
}
