import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import * as agents from '../../src/agents'
import { doctorCommand } from '../../src/commands/doctor'
import * as detect from '../../src/utils/detect'
import * as version from '../../src/utils/version'

const allAgentsSpy = jest.spyOn(agents, 'getAllAgents')
const isBunSpy = jest.spyOn(detect, 'isBunAvailable')
const isNpmSpy = jest.spyOn(detect, 'isNpmAvailable')
const binaryInPathSpy = jest.spyOn(detect, 'isBinaryInPath')
const installedVerSpy = jest.spyOn(version, 'getInstalledVersion')
const latestVerSpy = jest.spyOn(version, 'getLatestVersion')

afterAll(() => {
  allAgentsSpy.mockRestore()
  isBunSpy.mockRestore()
  isNpmSpy.mockRestore()
  binaryInPathSpy.mockRestore()
  installedVerSpy.mockRestore()
  latestVerSpy.mockRestore()
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

describe('doctorCommand', () => {
  let logSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    allAgentsSpy.mockClear()
    isBunSpy.mockClear()
    isNpmSpy.mockClear()
    binaryInPathSpy.mockClear()
    installedVerSpy.mockClear()
    latestVerSpy.mockClear()
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
    expect(output).toContain('available')
  })

  it('shows installed agents with versions', async () => {
    isBunSpy.mockResolvedValue(true)
    isNpmSpy.mockResolvedValue(false)
    allAgentsSpy.mockReturnValue([testAgent])
    binaryInPathSpy.mockResolvedValue(true)
    installedVerSpy.mockResolvedValue('1.0.0')
    latestVerSpy.mockResolvedValue('1.0.0')
    await doctorCommand()
    const output = logSpy.mock.calls.map((c: any[]) => c[0]).join('\n')
    expect(output).toContain('Test Agent')
    expect(output).toContain('1.0.0')
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
    expect(output).toContain('No package manager found')
  })
})
