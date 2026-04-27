import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as agents from '../../src/agents'
import { setCliContext } from '../../src/cli-context'
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
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows error for unknown agent', async () => {
    agentSpy.mockReturnValue(undefined)
    const code = await runCommand('unknown', [])
    expect(code).toBe(3)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
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
    installSpy.mockResolvedValue({ success: true })
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
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
  })

  it('returns 1 when install fails', async () => {
    mockPrompts.mockResolvedValue({ install: true })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: false })
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
  })

  it('returns 1 when spawn fails', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    mockSpawn.mockImplementation(() => {
      throw new Error('spawn error')
    })
    const code = await runCommand('test-agent', [])
    expect(code).toBe(1)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to launch'))
  })

  it('does not prompt in non-interactive mode when install is required', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    const code = await runCommand('test-agent', [], { nonInteractive: true })

    expect(code).toBe(7)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('interactive installation is disabled'))
  })

  it('emits structured rerun guidance when non-interactive mode blocks install prompting', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'exec-interaction-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    const code = await runCommand('test-agent', ['--help'], { nonInteractive: true })

    expect(code).toBe(7)
    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.action).toBe('exec')
    expect(payload.error.code).toBe('INTERACTION_REQUIRED')
    expect(payload.data.execution.installGuidance.suggestedAction).toBe('rerun-with-install-policy')
    expect(payload.data.execution.installGuidance.suggestedExecCommand).toBe('quantex exec test-agent --install if-missing -- --help')
  })

  it('returns agent-not-installed when install policy is never', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    const code = await runCommand('test-agent', [], { install: 'never' })

    expect(code).toBe(4)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(installSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('is not installed'))
  })

  it('emits structured install guidance when install policy is never in json mode', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'exec-missing-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    const code = await runCommand('test-agent', ['--help'], { install: 'never' })

    expect(code).toBe(4)
    const payload = JSON.parse(logSpy.mock.calls[0][0])
    expect(payload.ok).toBe(false)
    expect(payload.action).toBe('exec')
    expect(payload.error.code).toBe('AGENT_NOT_INSTALLED')
    expect(payload.data.execution.installGuidance.suggestedEnsureCommand).toBe('quantex ensure test-agent')
    expect(payload.data.execution.installGuidance.suggestedExecCommand).toBe('quantex exec test-agent --install if-missing -- --help')
  })

  it('installs automatically when install policy is if-missing', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: true })
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    const code = await runCommand('test-agent', ['--help'], { install: 'if-missing', nonInteractive: true })

    expect(code).toBe(0)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(installSpy).toHaveBeenCalledWith(testAgent)
    expect(mockSpawn).toHaveBeenCalledWith(['test-bin', '--help'], expect.any(Object))
  })

  it('accepts the install prompt automatically when assumeYes is enabled', async () => {
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)
    installSpy.mockResolvedValue({ success: true })
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    const code = await runCommand('test-agent', ['--help'], { assumeYes: true })

    expect(code).toBe(0)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(installSpy).toHaveBeenCalledWith(testAgent)
  })

  it('returns a dry-run success without installing or spawning', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'human',
      runId: 'dry-run-id',
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(false)

    const code = await runCommand('test-agent', ['--help'], { dryRun: true, install: 'if-missing', nonInteractive: true })

    expect(code).toBe(0)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(installSpy).not.toHaveBeenCalled()
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('returns timeout when the spawned agent exceeds the configured limit', async () => {
    let resolveExited: (() => void) | undefined
    const proc: any = {
      exitCode: null,
      exited: new Promise<void>((resolve) => {
        resolveExited = resolve
      }),
      kill: vi.fn(() => {
        proc.exitCode = 143
        resolveExited?.()
      }),
    }

    setCliContext({
      interactive: false,
      outputMode: 'human',
      runId: 'run-timeout-id',
      timeoutMs: 1,
    })
    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    mockSpawn.mockImplementation((command: string[]) => {
      if (command[1] === '--help')
        return proc

      if (command[1] === '--version') {
        return {
          exitCode: 0,
          exited: Promise.resolve(),
          stderr: '',
          stdout: 'test-bin 1.0.0\n',
        }
      }

      return {
        exitCode: 0,
        exited: Promise.resolve(),
        stderr: '',
        stdout: '/tmp/test-bin\n',
      }
    })

    const code = await runCommand('test-agent', ['--help'])

    expect(code).toBe(10)
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'))
  })

  it('returns cancelled when the spawned agent receives a termination signal', async () => {
    let resolveExited: (() => void) | undefined
    const proc: any = {
      exitCode: null,
      exited: new Promise<void>((resolve) => {
        resolveExited = resolve
      }),
      kill: vi.fn(() => {
        proc.exitCode = 143
        resolveExited?.()
      }),
    }

    agentSpy.mockReturnValue(testAgent)
    binaryInPathSpy.mockResolvedValue(true)
    mockSpawn.mockImplementation((command: string[]) => {
      if (command[1] === '--help')
        return proc

      if (command[1] === '--version') {
        return {
          exitCode: 0,
          exited: Promise.resolve(),
          stderr: '',
          stdout: 'test-bin 1.0.0\n',
        }
      }

      return {
        exitCode: 0,
        exited: Promise.resolve(),
        stderr: '',
        stdout: '/tmp/test-bin\n',
      }
    })

    const execution = runCommand('test-agent', ['--help'])
    await vi.waitFor(() => {
      expect(mockSpawn).toHaveBeenCalledWith(['test-bin', '--help'], expect.any(Object))
    })
    process.emit('SIGTERM')

    const code = await execution

    expect(code).toBe(11)
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled by SIGTERM'))
  })
})
