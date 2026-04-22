import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
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
})
