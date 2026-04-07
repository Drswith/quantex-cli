import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import * as agents from '../../src/agents'
import { infoCommand } from '../../src/commands/info'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const agentSpy = jest.spyOn(agents, 'getAgentByNameOrAlias')
const binaryInPathSpy = jest.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = jest.spyOn(version, 'getInstalledVersion')
const latestVerSpy = jest.spyOn(version, 'getLatestVersion')
const binaryPathSpy = jest.spyOn(version, 'getBinaryPath')

afterAll(() => {
  agentSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
  binaryPathSpy.mockRestore()
})

const testAgent = {
  name: 'test-agent',
  aliases: ['ta'],
  displayName: 'Test Agent',
  description: 'A test agent',
  package: 'test-pkg',
  binaryName: 'test-bin',
  installMethods: [
    { type: 'bun' as const, command: 'bun add -g test-pkg', supportedPlatforms: ['linux' as const], priority: 1 },
  ],
}

describe('infoCommand', () => {
  let logSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    agentSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
    binaryPathSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    await infoCommand('unknown')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('shows all agent details for known agent', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('2.0.0')
    binaryPathSpy.mockResolvedValue('/usr/bin/test-bin')
    await infoCommand('test-agent')
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('test-agent')
    expect(output).toContain('ta')
    expect(output).toContain('test-pkg')
    expect(output).toContain('test-bin')
    expect(output).toContain('1.0.0')
    expect(output).toContain('2.0.0')
    expect(output).toContain('/usr/bin/test-bin')
  })

  it('shows install methods with platform support indicators', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    await infoCommand('test-agent')
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Install Methods')
    expect(output).toContain('bun')
    expect(output).toContain('bun add -g test-pkg')
  })
})
