import type { AgentDefinition } from '../../src/agents'
import type { ProviderId } from '../../src/providers'
import type { ResolvedAgentObservation } from '../../src/services/lifecycle-observations'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { resetCliContext, setCliContext } from '../../src/cli-context'
import { doctorCommand } from '../../src/commands/doctor'
import { observeAgentLifecycle } from '../../src/lifecycle'
import * as selfModule from '../../src/self'
import * as coreReadObservations from '../../src/services/core-read-observations'
import * as providerObservations from '../../src/services/provider-observations'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

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
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')
const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelfReadOnly')
const observeRegisteredAgentsSpy = vi.spyOn(coreReadObservations, 'observeCliReadRegisteredAgents')
const providerSnapshotSpy = vi.spyOn(providerObservations, 'observeProviderSnapshot')

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
  binaryInPathSpy.mockRestore()
  installedStateSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
  inspectSelfSpy.mockRestore()
  observeRegisteredAgentsSpy.mockRestore()
  providerSnapshotSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  lookupAliases: ['ta'],
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  packages: { npm: 'test-pkg' },
  binaryName: 'test-bin',
  platforms: {
    linux: [{ packageName: 'test-pkg', type: 'bun' as const }],
    macos: [{ packageName: 'test-pkg', type: 'bun' as const }],
    windows: [{ packageName: 'test-pkg', type: 'bun' as const }],
  },
} satisfies AgentDefinition

const selfUpdatingAgent = {
  ...testAgent,
  binaryName: 'self-updating-bin',
  displayName: 'Self Updating Agent',
  name: 'self-updating-agent',
  selfUpdate: {
    command: ['self-updating-bin', 'update'],
    versionAfter: 'same-process' as const,
  },
} satisfies AgentDefinition

describe('doctorCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCliContext()
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
    binaryInPathSpy.mockClear()
    installedStateSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    inspectSelfSpy.mockClear()
    observeRegisteredAgentsSpy.mockReset()
    providerSnapshotSpy.mockReset()
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
    providerSnapshotSpy.mockResolvedValue(providerSnapshot())
    observeRegisteredAgentsSpy.mockImplementation(async () => {
      const observations: ResolvedAgentObservation[] = []
      for (const agent of agents.getAllAgents()) {
        const inPath = await detect.isBinaryInPath(agent.binaryName)
        const installedState = await state.getInstalledAgentState(agent.name)
        const installedVersion = inPath
          ? await version.getInstalledVersion(agent.binaryName, agent.versionProbe)
          : undefined
        const latestVersion = inPath ? await version.getLatestVersion(agent.packages?.npm ?? agent.name) : undefined
        const executable = {
          ...(inPath ? { path: `/path/${agent.binaryName}`, version: installedVersion } : {}),
          present: inPath,
        }
        observations.push({
          agent,
          capabilities: [],
          catalogMethods: [],
          executable,
          installedState,
          latestVersion,
          methods: [],
          observation: inPath
            ? {
                drift: installedState ? { kind: 'none' as const } : { kind: 'untracked' as const },
                kind: 'present' as const,
                targetId: agent.name,
                version: installedVersion,
              }
            : { drift: { kind: 'none' as const }, kind: 'absent' as const, targetId: agent.name },
          pathExecutable: executable,
          resolvedBinaryPath: inPath ? `/path/${agent.binaryName}` : undefined,
        })
      }
      return observations
    })
    installedStateSpy.mockResolvedValue(undefined)
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
  })

  afterEach(() => {
    resetCliContext()
    logSpy.mockRestore()
  })

  it('shows package manager availability', async () => {
    setProviderAvailability({ bun: true, npm: true })
    allAgentsSpy.mockReturnValue([])
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Bun')
    expect(output).toContain('npm')
    expect(output).toContain('brew')
    expect(output).toContain('cargo')
    expect(output).toContain('deno')
    expect(output).toContain('mise')
    expect(output).toContain('pip')
    expect(output).toContain('uv')
    expect(output).toContain('winget')
    expect(output).toContain('available')
    expect(output).toContain('Quantex CLI')
    expect(output).toContain('Auto-update')
  })

  it('shows manual recovery for outdated bun installs', async () => {
    setProviderAvailability({ bun: true })
    allAgentsSpy.mockReturnValue([])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await doctorCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Recovery:')
    expect(output).toContain('bun add -g quantex-cli@latest')
  })

  it('does not flag self as outdated when latest version is lower than current', async () => {
    setProviderAvailability({ bun: true, npm: true })
    allAgentsSpy.mockReturnValue([])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '0.15.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '0.14.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    const result = await doctorCommand()

    expect(result.data?.self.outdated).toBe(false)
    expect(result.data?.issues.find(issue => issue.code === 'SELF_UPDATE_AVAILABLE')).toBeUndefined()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Latest:       0.14.0')
    expect(output).not.toContain('update available')
  })

  it('shows manual recovery for outdated binary installs', async () => {
    const executablePath = process.platform === 'win32' ? 'C:\\Program Files\\Quantex\\qtx.exe' : '/usr/local/bin/qtx'
    setProviderAvailability({ bun: true })
    allAgentsSpy.mockReturnValue([])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath,
      installSource: 'binary',
      latestVersion: '1.1.0',
      packageRoot: process.platform === 'win32' ? 'C:\\Program Files\\Quantex' : '/usr/local/bin',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await doctorCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Recovery:')
    expect(output).toContain('/releases/latest/download/quantex-')
  })

  it('shows installed agents with versions', async () => {
    setProviderAvailability({ bun: true })
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue({
      agentName: 'test-agent',
      installType: 'bun',
      packageName: 'test-pkg',
      command: 'bun add -g test-pkg',
    })
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('1.0.0')
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Test Agent')
    expect(output).toContain('1.0.0')
    expect(output).toContain('managed')
    expect(output).toContain('managed via bun (test-pkg)')
  })

  it('shows no agents installed when none found', async () => {
    setProviderAvailability({ bun: true })
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(false)
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('No agents installed')
  })

  it('reports issues when no package managers', async () => {
    setProviderAvailability({})
    allAgentsSpy.mockReturnValue([])
    const result = await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('No managed installer found')
    expect(result.data?.installers).toEqual({
      brew: false,
      bun: false,
      cargo: false,
      deno: false,
      mise: false,
      npm: false,
      pip: false,
      uv: false,
      winget: false,
    })
    expect(result.data?.issues.find(issue => issue.code === 'NO_MANAGED_INSTALLER')).toEqual({
      blocking: true,
      category: 'installers',
      code: 'NO_MANAGED_INSTALLER',
      docsRef: 'docs/runbooks/quantex-troubleshooting.md',
      message:
        'No managed installer found. Install bun, npm, brew, cargo, deno, mise, pip, uv, or winget before relying on managed lifecycle operations.',
      severity: 'warning',
      subject: { kind: 'system' },
      suggestedAction: 'restore-managed-installer',
      suggestedCommands: [],
    })
  })

  it('warns when the detected self package manager is missing from PATH', async () => {
    setProviderAvailability({ npm: true })
    allAgentsSpy.mockReturnValue([])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '1.0.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await doctorCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('tracked as a bun install')
    expect(output).toContain('not available in PATH')
  })

  it('warns when Quantex cannot auto-update from the current install source', async () => {
    setProviderAvailability({ bun: true, npm: true })
    allAgentsSpy.mockReturnValue([])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: false,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/workspaces/quantex-cli/node_modules/.bin/bun',
      installSource: 'source',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/workspaces/quantex-cli',
      recommendedUpgradeCommand: undefined,
      updateChannel: 'stable',
    })

    await doctorCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('cannot auto-update from install source "source"')
    expect(output).toContain('Reinstall via bun, npm, or the standalone binary')
  })

  it('warns when an agent is only detected in PATH and not managed by Quantex', async () => {
    setProviderAvailability({ bun: true, npm: true })
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue(undefined)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')

    await doctorCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('available in PATH but not tracked as a managed Quantex install')
    expect(output).toContain('quantex inspect test-agent --json')
  })

  it('returns machine-actionable self remediation in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'doctor-run-id',
    })
    setProviderAvailability({ npm: true })
    allAgentsSpy.mockReturnValue([])
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '1.1.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    const result = await doctorCommand()
    const payload = JSON.parse(logSpy.mock.calls[0][0])
    const installerIssue = result.data?.issues.find(issue => issue.code === 'SELF_INSTALLER_MISSING')
    const updateIssue = result.data?.issues.find(issue => issue.code === 'SELF_UPDATE_AVAILABLE')

    expect(payload.meta.runId).toBe('doctor-run-id')
    expect(installerIssue).toMatchObject({
      blocking: true,
      category: 'self',
      docsRef: 'docs/runbooks/release-and-self-upgrade-debugging.md',
      subject: { kind: 'self', name: 'quantex' },
      suggestedAction: 'restore-self-installer',
      suggestedCommands: ['bun add -g quantex-cli@latest'],
    })
    expect(updateIssue).toMatchObject({
      category: 'self',
      suggestedAction: 'run-self-upgrade',
      suggestedCommands: ['quantex upgrade'],
    })
  })

  it('returns machine-actionable agent remediation in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'doctor-agent-run-id',
    })
    setProviderAvailability({ bun: true, npm: true })
    allAgentsSpy.mockReturnValue([selfUpdatingAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedStateSpy.mockResolvedValue(undefined)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')

    const result = await doctorCommand()
    const untrackedIssue = result.data?.issues.find(issue => issue.code === 'AGENT_UNTRACKED_IN_PATH')
    const updateIssue = result.data?.issues.find(issue => issue.code === 'AGENT_MANUAL_UPDATE_REQUIRED')

    expect(untrackedIssue).toMatchObject({
      category: 'agent',
      docsRef: 'docs/runbooks/quantex-troubleshooting.md',
      subject: { kind: 'agent', name: 'self-updating-agent' },
      suggestedAction: 'inspect-agent-install-source',
      suggestedCommands: ['quantex inspect self-updating-agent --json', 'quantex install self-updating-agent'],
    })
    expect(updateIssue).toMatchObject({
      category: 'agent',
      suggestedAction: 'run-agent-self-update',
      suggestedCommands: ['self-updating-bin update'],
    })
  })

  it('preserves issue pairings for a reachable timed-out provider observation', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'doctor-drift-run-id' })
    setProviderAvailability({ npm: true })
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '1.0.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })
    const observation = await timedOutAgentObservation()
    observeRegisteredAgentsSpy.mockResolvedValue([observation])

    const result = await doctorCommand()
    const payload = JSON.parse(logSpy.mock.calls[0][0])

    expect(observation.providerOutcome).toEqual({ kind: 'timed-out', timeoutMs: 25 })
    expect(observation.observation).toMatchObject({
      drift: { kind: 'indeterminate' },
      kind: 'indeterminate',
    })
    expect(result.data?.issues.find(issue => issue.code === 'AGENT_UNTRACKED_IN_PATH')).toBeUndefined()
    expect(result.data?.issues.find(issue => issue.code === 'SELF_INSTALLER_MISSING')).toMatchObject({
      blocking: true,
      category: 'self',
      suggestedAction: 'restore-self-installer',
      suggestedCommands: ['bun add -g quantex-cli@latest'],
    })
    expect(payload.data.agents[0]).not.toHaveProperty('drift')
    expect(providerSnapshotSpy).toHaveBeenCalledTimes(1)
    expect(observeRegisteredAgentsSpy).toHaveBeenCalledTimes(1)
    expect(inspectSelfSpy).toHaveBeenCalledTimes(1)
  })
})

function setProviderAvailability(available: Partial<Record<string, boolean>>): void {
  providerSnapshotSpy.mockResolvedValue(providerSnapshot(available))
}

function providerSnapshot(available: Partial<Record<string, boolean>> = {}) {
  const providerIds: ProviderId[] = [
    'bun',
    'npm',
    'brew',
    'cargo',
    'deno',
    'mise',
    'pip',
    'uv',
    'winget',
    'script',
    'binary',
  ]
  return providerIds.map(id => ({
    availability: available[id]
      ? { kind: 'success' as const, value: { executable: id } }
      : { kind: 'unavailable' as const, reason: `${id} unavailable` },
    capabilities: ['availability', 'observe'] as const,
    id,
  }))
}

async function timedOutAgentObservation(): Promise<ResolvedAgentObservation> {
  const result = await observeAgentLifecycle(testAgent, {
    clock: () => '2026-07-12T08:00:00.000Z',
    inspectExecutable: async () => ({ path: '/path/test-bin', present: true, version: '1.0.0' }),
    observeProvider: async () => ({ kind: 'timed-out', timeoutMs: 25 }),
    platform: 'linux',
    providerRegistry: {
      get: () => undefined,
      getCapabilities: () => ['availability', 'observe'],
      list: () => [],
    },
    readInstalledState: async () => undefined,
    readReceipt: async () => undefined,
    signal: new AbortController().signal,
    timeoutMs: 25,
  })

  return {
    agent: testAgent,
    ...result,
    latestVersion: '1.0.0',
    methods: [],
    resolvedBinaryPath: '/path/test-bin',
  }
}
