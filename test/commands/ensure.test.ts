import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { ensureCommand } from '../../src/commands/ensure'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = vi.spyOn(pm, 'installAgent')
const trackSpy = vi.spyOn(pm, 'trackInstalledAgent')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')
const installedStateSpy = vi.spyOn(state, 'getInstalledAgentState')

afterAll(() => {
  agentSpy.mockRestore()
  installSpy.mockRestore()
  trackSpy.mockRestore()
  binaryInPathSpy.mockRestore()
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

describe('ensureCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    installSpy.mockClear()
    trackSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedStateSpy.mockClear()
    installedStateSpy.mockResolvedValue(undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await ensureCommand('unknown')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
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

  it('tracks an existing script install when ensure can identify the source safely', async () => {
    agentSpy.mockReturnValue(scriptOnlyAgent)
    binaryInPathSpy.mockResolvedValue(true)
    trackSpy.mockResolvedValue({
      agentName: 'script-agent',
      installType: 'script',
      command: 'curl https://example.com/install | bash',
    })

    await ensureCommand('script-agent')

    expect(trackSpy).toHaveBeenCalledWith(
      scriptOnlyAgent,
      expect.objectContaining({
        command: 'curl https://example.com/install | bash',
        type: 'script',
      }),
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
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({
      installedState: {
        agentName: 'test-agent',
        installType: 'bun',
        packageName: 'test-pkg',
      },
      success: true,
    })

    await ensureCommand('test-agent')

    expect(installSpy).toHaveBeenCalledWith(testAgent)
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
    binaryInPathSpy.mockResolvedValue(false)
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
})
