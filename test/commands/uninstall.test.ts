import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import * as agents from '../../src/agents'
import { uninstallCommand } from '../../src/commands/uninstall'
import * as pm from '../../src/package-manager'

const agentSpy = jest.spyOn(agents, 'getAgentByNameOrAlias')
const uninstallSpy = jest.spyOn(pm, 'uninstallAgent')

afterAll(() => {
  agentSpy.mockRestore()
  uninstallSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  aliases: ['ta'],
  displayName: 'Test Agent',
  description: 'test',
  package: 'test-pkg',
  binaryName: 'test-bin',
  installMethods: [],
}

describe('uninstallCommand', () => {
  let logSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
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
