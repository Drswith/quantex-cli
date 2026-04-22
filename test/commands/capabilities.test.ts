import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { capabilitiesCommand } from '../../src/commands/capabilities'
import * as selfModule from '../../src/self'
import * as detect from '../../src/utils/detect'

const allAgentsSpy = vi.spyOn(agents, 'getAllAgents')
const isBunSpy = vi.spyOn(detect, 'isBunAvailable')
const isNpmSpy = vi.spyOn(detect, 'isNpmAvailable')
const isBrewSpy = vi.spyOn(detect, 'isBrewAvailable')
const isWingetSpy = vi.spyOn(detect, 'isWingetAvailable')
const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelf')

afterAll(() => {
  allAgentsSpy.mockRestore()
  isBunSpy.mockRestore()
  isNpmSpy.mockRestore()
  isBrewSpy.mockRestore()
  isWingetSpy.mockRestore()
  inspectSelfSpy.mockRestore()
})

describe('capabilitiesCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    allAgentsSpy.mockClear()
    isBunSpy.mockClear()
    isNpmSpy.mockClear()
    isBrewSpy.mockClear()
    isWingetSpy.mockClear()
    inspectSelfSpy.mockClear()
    allAgentsSpy.mockReturnValue([
      {
        binaryName: 'claude',
        description: 'Claude Code',
        displayName: 'Claude Code',
        homepage: 'https://example.com/claude',
        name: 'claude',
        platforms: { linux: [], macos: [], windows: [] },
      } as any,
      {
        binaryName: 'codex',
        description: 'Codex',
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
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows installer availability and feature summary', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    isBrewSpy.mockResolvedValue(false)
    isWingetSpy.mockResolvedValue(false)

    await capabilitiesCommand()

    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Quantex Capabilities')
    expect(output).toContain('Platform:')
    expect(output).toContain('Agents:')
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
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(true)
    isBrewSpy.mockResolvedValue(false)
    isWingetSpy.mockResolvedValue(false)

    await capabilitiesCommand()

    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('capabilities')
    expect(payload.data.agents).toEqual(['claude', 'codex'])
    expect(payload.data.features.execInstallPolicies).toEqual(['never', 'if-missing', 'always'])
    expect(payload.data.outputModes).toEqual(['human', 'json'])
    expect(payload.meta.runId).toBe('cap-run-id')
  })
})
