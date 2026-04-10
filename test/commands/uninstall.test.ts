import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { uninstallCommand } from '../../src/commands/uninstall'
import * as pm from '../../src/package-manager'

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const uninstallSpy = vi.spyOn(pm, 'uninstallAgent')

afterAll(() => {
  agentSpy.mockRestore()
  uninstallSpy.mockRestore()
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

describe('uninstallCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    agentSpy.mockClear()
    uninstallSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await uninstallCommand('unknown')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('calls uninstallAgent and shows success', async () => {
    agentSpy.mockReturnValue(testAgent)
    uninstallSpy.mockResolvedValue(true)
    await uninstallCommand('test-agent')
    expect(uninstallSpy).toHaveBeenCalledWith(testAgent)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('uninstalled successfully'))
  })

  it('shows failure message', async () => {
    agentSpy.mockReturnValue(testAgent)
    uninstallSpy.mockResolvedValue(false)
    await uninstallCommand('test-agent')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to uninstall'))
  })
})
