import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { installCommand } from '../../src/commands/install'
import * as pm from '../../src/package-manager'
import * as state from '../../src/state'
import * as detect from '../../src/utils/detect'
import { ResourceLockError } from '../../src/utils/lock'

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

describe('installCommand', () => {
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
    await installCommand('unknown')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
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
      command: 'curl https://example.com/install | bash',
    })

    await installCommand('script-agent')

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
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: true })
    await installCommand('test-agent')
    expect(installSpy).toHaveBeenCalledWith(testAgent)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('installed successfully'))
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
  })

  it('suppresses informational success logs in quiet mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'human',
      quiet: true,
      runId: 'quiet-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: true })

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
    binaryInPathSpy.mockResolvedValue(false)
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
    binaryInPathSpy.mockResolvedValue(false)
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
})
