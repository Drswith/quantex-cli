import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { doctorCommand } from '../../src/commands/doctor'
import * as selfModule from '../../src/self'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const isBunSpy = vi.spyOn(detect, 'isBunAvailable')
const isNpmSpy = vi.spyOn(detect, 'isNpmAvailable')
const isBrewSpy = vi.spyOn(detect, 'isBrewAvailable')
const isWingetSpy = vi.spyOn(detect, 'isWingetAvailable')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')
const installedVerSpy = vi.spyOn(version, 'getInstalledVersion')
const latestVerSpy = vi.spyOn(version, 'getLatestVersion')
const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelf')

afterAll(() => {
  allAgentsSpy.mockRestore()
  isBunSpy.mockRestore()
  isNpmSpy.mockRestore()
  isBrewSpy.mockRestore()
  isWingetSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedStateSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
  inspectSelfSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  lookupAliases: ['ta'],
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

const selfUpdatingAgent = {
  ...testAgent,
  binaryName: 'self-updating-bin',
  displayName: 'Self Updating Agent',
  name: 'self-updating-agent',
  selfUpdate: {
    command: ['self-updating-bin', 'update'],
    versionAfter: 'same-process' as const,
  },
}

describe('doctorCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    allAgentsSpy.mockClear()
    isBunSpy.mockClear()
    isNpmSpy.mockClear()
    isBrewSpy.mockClear()
    isWingetSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedStateSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    inspectSelfSpy.mockClear()
    isBrewSpy.mockResolvedValue(false)
    isWingetSpy.mockResolvedValue(false)
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
    logSpy.mockRestore()
  })

  it('shows package manager availability', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    allAgentsSpy.mockReturnValue([])
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Bun')
    expect(output).toContain('npm')
    expect(output).toContain('brew')
    expect(output).toContain('winget')
    expect(output).toContain('available')
    expect(output).toContain('Quantex CLI')
    expect(output).toContain('Auto-update')
  })

  it('shows manual recovery for outdated bun installs', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(false)
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

  it('shows manual recovery for outdated binary installs', async () => {
    const executablePath = process.platform === 'win32' ? 'C:\\Program Files\\Quantex\\qtx.exe' : '/usr/local/bin/qtx'
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(false)
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
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(false)
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
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(false)
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(false)
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('No agents installed')
  })

  it('reports issues when no package managers', async () => {
    isBunSpy.mockResolvedValue(false)
    isNpmSpy.mockResolvedValue(false)
    allAgentsSpy.mockReturnValue([])
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('No managed installer found')
  })

  it('warns when the detected self package manager is missing from PATH', async () => {
    isBunSpy.mockResolvedValue(false)
    isNpmSpy.mockResolvedValue(true)
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
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
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
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
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
    isBunSpy.mockResolvedValue(false)
    isNpmSpy.mockResolvedValue(true)
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
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
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
})
