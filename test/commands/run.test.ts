import type { AgentExecutionOutcome, LifecycleExecutionObservedAgent } from '../../src/services'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../../src/cli-context'
import { runCommand, type RunCommandDependencies } from '../../src/commands/run'

const mockPrompts = vi.fn()

vi.mock('prompts', () => ({
  default: (...args: unknown[]) => mockPrompts(...args),
}))

describe('runCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    mockPrompts.mockReset()
  })

  afterEach(() => {
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('shows an error for an unknown agent and disposes the execution service', async () => {
    const fixture = executionFixture({ kind: 'not-found' })

    await expect(runCommand('unknown', [], {}, fixture.dependencies)).resolves.toBe(3)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
    expect(fixture.service.dispose).toHaveBeenCalledOnce()
  })

  it('passes the exact request to the service and preserves the agent exit code', async () => {
    const fixture = executionFixture({ exitCode: 42, kind: 'exited', observed })

    await expect(runCommand('test-agent', ['--help'], { install: 'never' }, fixture.dependencies)).resolves.toBe(42)
    expect(fixture.service.execute).toHaveBeenCalledWith({
      agentName: 'test-agent',
      args: ['--help'],
      installPolicy: 'never',
    })
  })

  it('prompts through the production-service confirmation port', async () => {
    mockPrompts.mockResolvedValue({ install: true })
    const fixture = executionFixture(async options => {
      expect(await options.confirmInstall(observed)).toBe(true)
      return { exitCode: 0, kind: 'exited', observed }
    })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(0)
    expect(mockPrompts).toHaveBeenCalledWith(expect.objectContaining({ type: 'confirm' }))
  })

  it('does not prompt when assume-yes confirms installation', async () => {
    const fixture = executionFixture(async options => {
      expect(await options.confirmInstall(observed)).toBe(true)
      return { exitCode: 0, kind: 'exited', observed }
    })

    await expect(runCommand('test-agent', [], { assumeYes: true }, fixture.dependencies)).resolves.toBe(0)
    expect(mockPrompts).not.toHaveBeenCalled()
  })

  it('reports a declined installation', async () => {
    const fixture = executionFixture({ kind: 'install-declined', observed })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(1)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
  })

  it('reports a failed installation without leaking service internals', async () => {
    const fixture = executionFixture({ kind: 'install-failed', observed, reason: 'provider failed' })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(1)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'))
  })

  it('reports launch failures', async () => {
    const fixture = executionFixture({ kind: 'launch-failed', observed, reason: 'spawn error' })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(1)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to launch Test Agent: spawn error'))
  })

  it('does not prompt when non-interactive execution requires interaction', async () => {
    const fixture = executionFixture({ kind: 'interaction-required', observed })

    await expect(runCommand('test-agent', [], { nonInteractive: true }, fixture.dependencies)).resolves.toBe(7)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('interactive installation is disabled'))
  })

  it('emits structured rerun guidance for interaction-required outcomes', async () => {
    setJsonContext('exec-interaction-run-id')
    const fixture = executionFixture({ kind: 'interaction-required', observed })

    await expect(runCommand('test-agent', ['--help'], { nonInteractive: true }, fixture.dependencies)).resolves.toBe(7)
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(payload.error.code).toBe('INTERACTION_REQUIRED')
    expect(payload.data.execution.installGuidance.suggestedExecCommand).toBe(
      'quantex exec test-agent --install if-missing -- --help',
    )
  })

  it('reports a forbidden missing installation without prompting', async () => {
    const fixture = executionFixture({ kind: 'not-installed', observed })

    await expect(runCommand('test-agent', [], { install: 'never' }, fixture.dependencies)).resolves.toBe(4)
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('is not installed'))
  })

  it('emits structured installation guidance for not-installed outcomes', async () => {
    setJsonContext('exec-missing-run-id')
    const fixture = executionFixture({ kind: 'not-installed', observed })

    await expect(runCommand('test-agent', ['--help'], { install: 'never' }, fixture.dependencies)).resolves.toBe(4)
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(payload.error.code).toBe('AGENT_NOT_INSTALLED')
    expect(payload.data.execution.installGuidance.suggestedEnsureCommand).toBe('quantex ensure test-agent')
  })

  it('passes automatic installation policy without prompting', async () => {
    const fixture = executionFixture({ exitCode: 0, kind: 'exited', observed })

    await expect(
      runCommand('test-agent', ['--help'], { install: 'if-missing', nonInteractive: true }, fixture.dependencies),
    ).resolves.toBe(0)
    expect(fixture.service.execute).toHaveBeenCalledWith(expect.objectContaining({ installPolicy: 'if-missing' }))
    expect(mockPrompts).not.toHaveBeenCalled()
  })

  it('renders the installation-start event supplied to the service', async () => {
    const fixture = executionFixture(async options => {
      await options.onInstallStart?.(observed)
      return { exitCode: 0, kind: 'exited', observed }
    })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(0)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Installing Test Agent'))
  })

  it('returns dry-run success without presenting the installation event as real work', async () => {
    const fixture = executionFixture({
      argv: ['test-bin', '--help'],
      kind: 'dry-run',
      observed,
      wouldInstall: true,
    })

    await expect(
      runCommand('test-agent', ['--help'], { dryRun: true, install: 'if-missing' }, fixture.dependencies),
    ).resolves.toBe(0)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('would install Test Agent'))
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('would run test-bin --help'))
  })

  it('emits a structured dry-run result', async () => {
    setJsonContext('exec-dry-run-id')
    const fixture = executionFixture({ argv: ['test-bin'], kind: 'dry-run', observed, wouldInstall: false })

    await expect(runCommand('test-agent', [], { dryRun: true }, fixture.dependencies)).resolves.toBe(0)
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(payload.ok).toBe(true)
    expect(payload.data.execution).toMatchObject({ installed: true, launched: false })
  })

  it('distinguishes an installation timeout in the compatibility message', async () => {
    const fixture = executionFixture({ kind: 'timed-out', observed, phase: 'install', timeoutMs: 25 })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(10)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Installing Test Agent timed out after 25ms'))
  })

  it('distinguishes a launch timeout in the compatibility message', async () => {
    const fixture = executionFixture({ kind: 'timed-out', observed, phase: 'launch', timeoutMs: 25 })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(10)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Test Agent timed out after 25ms'))
  })

  it('preserves structured state-read errors from lifecycle observation', async () => {
    setJsonContext('exec-state-error-id')
    const fixture = executionFixture({
      error: {
        code: 'STATE_READ_ERROR',
        details: { stateFilePath: '/tmp/state.json' },
        kind: 'invalid-data',
        message: 'State is corrupt.',
      },
      kind: 'observation-failed',
    })

    await expect(runCommand('test-agent', [], {}, fixture.dependencies)).resolves.toBe(12)
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(payload.error).toMatchObject({
      code: 'STATE_READ_ERROR',
      details: { stateFilePath: '/tmp/state.json' },
    })
  })

  it('cancels active operations on SIGTERM and reports the cancellation signal', async () => {
    let finish: ((outcome: AgentExecutionOutcome) => void) | undefined
    const fixture = executionFixture(
      () =>
        new Promise<AgentExecutionOutcome>(resolve => {
          finish = resolve
        }),
    )
    const execution = runCommand('test-agent', [], {}, fixture.dependencies)
    await vi.waitFor(() => expect(fixture.service.execute).toHaveBeenCalledOnce())

    process.emit('SIGTERM')
    await vi.waitFor(() => expect(fixture.dependencies.cancelOperations).toHaveBeenCalledOnce())
    finish?.({ kind: 'cancelled', observed, phase: 'launch' })

    await expect(execution).resolves.toBe(11)
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('cancelled by SIGTERM'))
  })
})

type ExecutionFactoryOptions = Parameters<RunCommandDependencies['createExecutionService']>[0]

function executionFixture(
  result:
    | AgentExecutionOutcome
    | ((options: ExecutionFactoryOptions) => AgentExecutionOutcome | Promise<AgentExecutionOutcome>),
) {
  let options: ExecutionFactoryOptions
  const service = {
    dispose: vi.fn(),
    execute: vi.fn(async () => (typeof result === 'function' ? await result(options) : result)),
  }
  const dependencies: RunCommandDependencies = {
    cancelOperations: vi.fn(async () => undefined),
    createExecutionService: vi.fn(received => {
      options = received
      return service
    }),
  }
  return { dependencies, service }
}

function setJsonContext(runId: string): void {
  setCliContext({ interactive: false, outputMode: 'json', runId })
}

const observed: LifecycleExecutionObservedAgent = {
  agent: {
    binaryName: 'test-bin',
    displayName: 'Test Agent',
    homepage: 'https://example.com',
    name: 'test-agent',
    platforms: {},
  },
  executable: { path: '/tmp/test-bin', present: true, version: '1.0.0' },
  methods: [{ packageName: 'test-pkg', type: 'npm' }],
  observation: {
    drift: { kind: 'none' },
    executablePath: '/tmp/test-bin',
    kind: 'present',
    targetId: 'test-agent',
    version: '1.0.0',
  },
}
