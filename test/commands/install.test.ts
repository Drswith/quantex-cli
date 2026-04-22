import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
import { installCommand } from '../../src/commands/install'
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

describe('installCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    agentSpy.mockClear()
    installSpy.mockClear()
    binaryInPathSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await installCommand('unknown')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows already installed when binary exists', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    await installCommand('test-agent')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
    expect(installSpy).not.toHaveBeenCalled()
  })

  it('calls installAgent and shows success', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: true })
    await installCommand('test-agent')
    expect(installSpy).toHaveBeenCalledWith(testAgent)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('installed successfully'))
  })

  it('shows failure message when installAgent returns false', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: false })
    await installCommand('test-agent')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
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
})
