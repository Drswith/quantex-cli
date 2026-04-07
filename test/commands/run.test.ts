import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import * as agents from '../../src/agents'
import { runCommand } from '../../src/commands/run'
import * as pm from '../../src/package-manager'
import * as detect from '../../src/utils/detect'

const agentSpy = jest.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = jest.spyOn(pm, 'installAgent')
const binaryInPathSpy = jest.spyOn(detect, 'isBinaryInPath')

const mockSpawn = jest.fn()
let originalSpawn: typeof Bun.spawn

const mockPrompts = jest.fn<() => Promise<{ install: boolean }>>()

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

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
  agentSpy.mockClear()
  installSpy.mockClear()
  binaryInPathSpy.mockClear()
  mockPrompts.mockClear()
  mockSpawn.mockClear()
})

afterEach(() => {
  Bun.spawn = originalSpawn
})

describe('runCommand', () => {
  let logSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    const code = await runCommand('unknown', [])
    expect(code).toBe(1)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('runs agent directly if installed, returns exit code', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    const code = await runCommand('test-agent', ['--help'])
    expect(code).toBe(0)
    expect(mockSpawn).toHaveBeenCalledWith(['test-bin', '--help'], expect.any(Object))
  })

  it('prompts for install when not installed, then runs if confirmed', async () => {
    const promptsSpy = jest.spyOn(await import('prompts') as any, 'default')
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    promptsSpy.mockResolvedValue({ install: true })
    installSpy.mockResolvedValue(true)
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    const code = await runCommand('test-agent', [])
    expect(code).toBe(0)
    expect(installSpy).toHaveBeenCalledWith(testAgent)
    promptsSpy.mockRestore()
  })

  it('returns 1 when user cancels install', async () => {
    const promptsModule = await import('prompts')
    const promptsSpy = jest.spyOn(promptsModule as any, 'default')
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    promptsSpy.mockResolvedValue({ install: false })
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
    promptsSpy.mockRestore()
  })

  it('returns 1 when install fails', async () => {
    const promptsModule = await import('prompts')
    const promptsSpy = jest.spyOn(promptsModule as any, 'default')
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    promptsSpy.mockResolvedValue({ install: true })
    installSpy.mockResolvedValue(false)
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
    promptsSpy.mockRestore()
  })

  it('returns 1 when spawn fails', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    mockSpawn.mockImplementation(() => {
      throw new Error('spawn error')
    })
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to launch'))
  })
})
