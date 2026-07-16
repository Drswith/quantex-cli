import type { RuntimeFailure, RuntimeOutcome } from '../../src/runtime'
import { describe, expect, it, vi } from 'vitest'
import {
  executeAgentLifecycle,
  type LifecycleExecutionObservedAgent,
  type LifecycleExecutionServicePorts,
} from '../../src/services/lifecycle-execution'

const controller = new AbortController()

describe('executeAgentLifecycle', () => {
  it('returns not-found without installing or launching', async () => {
    const ports = fakePorts({ observations: [undefined] })

    await expect(executeAgentLifecycle(request(), ports)).resolves.toEqual({ kind: 'not-found' })
    expect(ports.install).not.toHaveBeenCalled()
    expect(ports.process.run).not.toHaveBeenCalled()
  })

  it('launches an observed executable with inherited human stdio and preserves its exit code', async () => {
    const ports = fakePorts({ processResult: success({ exitCode: 42 }), observations: [observed(true)] })

    await expect(executeAgentLifecycle(request({ args: ['--help'] }), ports)).resolves.toMatchObject({
      exitCode: 42,
      kind: 'exited',
    })
    expect(ports.process.run).toHaveBeenCalledWith({
      argv: ['test-bin', '--help'],
      signal: controller.signal,
      stdio: ['inherit', 'inherit', 'inherit'],
      timeoutMs: 5_000,
    })
  })

  it('reserves stdout for structured output', async () => {
    const ports = fakePorts({ observations: [observed(true)], outputMode: 'json' })

    await executeAgentLifecycle(request(), ports)

    expect(ports.process.run).toHaveBeenCalledWith(expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }))
  })

  it('rejects an absent executable when installation is forbidden', async () => {
    const ports = fakePorts({ observations: [observed(false)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'never' }), ports)).resolves.toMatchObject({
      kind: 'not-installed',
      observed: observed(false),
    })
    expect(ports.install).not.toHaveBeenCalled()
    expect(ports.process.run).not.toHaveBeenCalled()
  })

  it('returns interaction-required without prompting in non-interactive prompt mode', async () => {
    const ports = fakePorts({ interactive: false, observations: [observed(false)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'prompt' }), ports)).resolves.toMatchObject({
      kind: 'interaction-required',
    })
    expect(ports.confirmInstall).not.toHaveBeenCalled()
  })

  it('returns install-declined when the user rejects the prompt', async () => {
    const ports = fakePorts({ confirmInstall: false, observations: [observed(false)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'prompt' }), ports)).resolves.toMatchObject({
      kind: 'install-declined',
    })
    expect(ports.install).not.toHaveBeenCalled()
    expect(ports.process.run).not.toHaveBeenCalled()
  })

  it('installs, re-observes, and only then launches', async () => {
    const callOrder: string[] = []
    const ports = fakePorts({ observations: [observed(false), observed(true)] })
    vi.mocked(ports.observe).mockImplementation(async () => {
      callOrder.push('observe')
      return success(callOrder.length === 1 ? observed(false) : observed(true))
    })
    vi.mocked(ports.install).mockImplementation(async () => {
      callOrder.push('install')
      return { kind: 'success', value: undefined }
    })
    vi.mocked(ports.onInstallStart!).mockImplementation(() => {
      callOrder.push('install-start')
    })
    vi.mocked(ports.process.run).mockImplementation(async () => {
      callOrder.push('launch')
      return success({ exitCode: 0 })
    })

    await expect(executeAgentLifecycle(request({ installPolicy: 'if-missing' }), ports)).resolves.toMatchObject({
      exitCode: 0,
      kind: 'exited',
    })
    expect(callOrder).toEqual(['observe', 'install-start', 'install', 'observe', 'launch'])
  })

  it('does not launch when installation reports success but fresh observation remains absent', async () => {
    const ports = fakePorts({ observations: [observed(false), observed(false)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'if-missing' }), ports)).resolves.toMatchObject({
      kind: 'install-failed',
      reason: 'executable-absent-after-install',
    })
    expect(ports.process.run).not.toHaveBeenCalled()
  })

  it.each([
    [
      { kind: 'cancelled' as const, reason: 'cancelled' },
      { kind: 'cancelled', reason: 'cancelled' },
    ],
    [
      { kind: 'timed-out' as const, timeoutMs: 123 },
      { kind: 'timed-out', timeoutMs: 123 },
    ],
    [
      { kind: 'failed' as const, reason: 'provider failed', retryable: false },
      { kind: 'install-failed', reason: 'provider failed' },
    ],
    [
      { kind: 'indeterminate' as const, reason: 'verification unavailable' },
      { kind: 'install-failed', reason: 'verification unavailable' },
    ],
  ])('maps a non-success installation outcome without launching', async (installResult, expected) => {
    const ports = fakePorts({ installResult, observations: [observed(false)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'if-missing' }), ports)).resolves.toMatchObject(
      expected,
    )
    expect(ports.process.run).not.toHaveBeenCalled()
  })

  it('returns a dry-run plan without prompting, installing, or launching', async () => {
    const ports = fakePorts({ dryRun: true, observations: [observed(false)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'prompt' }), ports)).resolves.toMatchObject({
      argv: ['test-bin', '--version'],
      kind: 'dry-run',
      wouldInstall: true,
    })
    expect(ports.confirmInstall).not.toHaveBeenCalled()
    expect(ports.install).not.toHaveBeenCalled()
    expect(ports.process.run).not.toHaveBeenCalled()
  })

  it('reports a present dry run without an install action', async () => {
    const ports = fakePorts({ dryRun: true, observations: [observed(true)] })

    await expect(executeAgentLifecycle(request({ installPolicy: 'always' }), ports)).resolves.toMatchObject({
      kind: 'dry-run',
      wouldInstall: false,
    })
  })

  it.each([
    [failure('cancelled', 'child cancelled'), { kind: 'cancelled', reason: 'child cancelled' }],
    [failure('timed-out', 'child timed out'), { kind: 'timed-out', timeoutMs: 5_000 }],
    [failure('failed', 'spawn failed'), { kind: 'launch-failed', reason: 'spawn failed' }],
  ])('maps typed process failures', async (processResult, expected) => {
    const ports = fakePorts({ observations: [observed(true)], processResult })

    await expect(executeAgentLifecycle(request(), ports)).resolves.toMatchObject(expected)
  })

  it('returns observation-failed when live preflight observation fails', async () => {
    const ports = fakePorts({ observationResult: failure('invalid-data', 'state is corrupt') })

    await expect(executeAgentLifecycle(request(), ports)).resolves.toMatchObject({
      error: { kind: 'invalid-data', message: 'state is corrupt' },
      kind: 'observation-failed',
    })
    expect(ports.process.run).not.toHaveBeenCalled()
  })
})

interface FakePortsOptions {
  confirmInstall?: boolean
  dryRun?: boolean
  installResult?: Awaited<ReturnType<LifecycleExecutionServicePorts['install']>>
  interactive?: boolean
  observationResult?: RuntimeOutcome<LifecycleExecutionObservedAgent | undefined>
  observations?: Array<LifecycleExecutionObservedAgent | undefined>
  outputMode?: LifecycleExecutionServicePorts['outputMode']
  processResult?: Awaited<ReturnType<LifecycleExecutionServicePorts['process']['run']>>
}

function fakePorts(options: FakePortsOptions = {}): LifecycleExecutionServicePorts {
  const observations = [...(options.observations ?? [observed(true)])]
  return {
    confirmInstall: vi.fn(async () => options.confirmInstall ?? true),
    dryRun: options.dryRun ?? false,
    install: vi.fn(async () => options.installResult ?? ({ kind: 'success', value: undefined } as const)),
    interactive: options.interactive ?? true,
    observe: vi.fn(async () => options.observationResult ?? success(observations.shift())),
    onInstallStart: vi.fn(),
    outputMode: options.outputMode ?? 'human',
    process: {
      run: vi.fn(async () => options.processResult ?? success({ exitCode: 0 })),
    },
    signal: controller.signal,
    timeoutMs: 5_000,
  }
}

function request(overrides: Partial<Parameters<typeof executeAgentLifecycle>[0]> = {}) {
  return {
    agentName: 'test-agent',
    args: ['--version'],
    installPolicy: 'never' as const,
    ...overrides,
  }
}

function observed(present: boolean): LifecycleExecutionObservedAgent {
  return {
    agent: {
      binaryName: 'test-bin',
      displayName: 'Test Agent',
      homepage: 'https://example.com',
      name: 'test-agent',
      platforms: {},
    },
    executable: present ? { path: '/tmp/test-bin', present: true, version: '1.0.0' } : { present: false },
    methods: [{ packageName: 'test-package', type: 'npm' }],
    observation: present
      ? {
          drift: { kind: 'none' },
          executablePath: '/tmp/test-bin',
          kind: 'present',
          targetId: 'test-agent',
          version: '1.0.0',
        }
      : {
          drift: { kind: 'none' },
          kind: 'absent',
          targetId: 'test-agent',
        },
  }
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}

function failure(kind: RuntimeFailure['kind'], message: string): RuntimeOutcome<never> {
  return { kind: 'failure', error: { kind, message } }
}
