import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { ensureCommand } from '../../src/commands/ensure'
import * as pm from '../../src/package-manager'
import * as detect from '../../src/utils/detect'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = vi.spyOn(pm, 'installAgent')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')

afterAll(() => {
  agentSpy.mockRestore()
  installSpy.mockRestore()
  binaryInPathSpy.mockRestore()
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

describe('ensureCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    agentSpy.mockClear()
    installSpy.mockClear()
    binaryInPathSpy.mockClear()
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

  it('returns already installed without reinstalling', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)

    await ensureCommand('test-agent')

    expect(installSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
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
