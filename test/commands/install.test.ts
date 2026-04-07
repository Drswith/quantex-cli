import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import * as agents from '../../src/agents'
import { installCommand } from '../../src/commands/install'
import * as pm from '../../src/package-manager'
import * as detect from '../../src/utils/detect'

const agentSpy = jest.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = jest.spyOn(pm, 'installAgent')
const binaryInPathSpy = jest.spyOn(detect, 'isBinaryInPath')

afterAll(() => {
  agentSpy.mockRestore()
  installSpy.mockRestore()
  binaryInPathSpy.mockRestore()
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

describe('installCommand', () => {
  let logSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
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
    installSpy.mockResolvedValue(true)
    await installCommand('test-agent')
    expect(installSpy).toHaveBeenCalledWith(testAgent)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('installed successfully'))
  })

  it('shows failure message when installAgent returns false', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue(false)
    await installCommand('test-agent')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
  })
})
