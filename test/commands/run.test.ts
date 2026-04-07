import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { runCommand } from '../../src/commands/run'
import * as pm from '../../src/package-manager'
import * as detect from '../../src/utils/detect'

const mockPrompts = vi.fn()

vi.mock('prompts', () => ({
  default: (...args: any[]) => mockPrompts(...args),
}))

const agentSpy = vi.spyOn(agents, 'getAgentByNameOrAlias')
const installSpy = vi.spyOn(pm, 'installAgent')
const binaryInPathSpy = vi.spyOn(detect, 'isBinaryInPath')

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn

const testAgent = {
  name: 'test-agent',
  aliases: ['ta'],
  displayName: 'Test Agent',
  description: 'test',
  homepage: 'https://example.com',
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

afterAll(() => {
  agentSpy.mockRestore()
  installSpy.mockRestore()
  binaryInPathSpy.mockRestore()
})

describe('runCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
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
    mockPrompts.mockResolvedValue({ install: true })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue(true)
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    const code = await runCommand('test-agent', [])
    expect(code).toBe(0)
    expect(installSpy).toHaveBeenCalledWith(testAgent)
  })

  it('returns 1 when user cancels install', async () => {
    mockPrompts.mockResolvedValue({ install: false })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
  })

  it('returns 1 when install fails', async () => {
    mockPrompts.mockResolvedValue({ install: true })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue(false)
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
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
