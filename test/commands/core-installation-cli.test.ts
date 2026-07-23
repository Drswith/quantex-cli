import type { AgentDefinition } from '../../src/agents'
import type {
  CoreInstallationCompatibilityExecutor,
  CoreInstallationCompatibilityRequest,
} from '../../src/core/installation-compatibility'
import type { CoreInstallationExecutionOutcome } from '../../src/core/installation-executor'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { LifecycleObservation, LifecycleReceipt } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { InstalledAgentState } from '../../src/state'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import { executeCommandWithRuntime } from '../../src/command-runtime'
import {
  createCoreInstallationCliSession,
  projectCoreInstallationOutcome,
} from '../../src/commands/core-installation-cli'
import { runCoreInvocation, type CoreInvocationOutcome } from '../../src/core/invocation'
import { StateSchemaError } from '../../src/state/schema'
import { ResourceLockError } from '../../src/utils/lock'

const agent: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  name: 'fixture-agent',
  packages: { npm: 'fixture-agent' },
  platforms: { linux: [{ type: 'npm' }] },
}

const binding: LifecycleProviderBinding = {
  providerId: 'npm',
  target: { id: agent.name, kind: 'package' },
}

const installedState: InstalledAgentState = {
  agentName: agent.name,
  binaryName: agent.binaryName,
  installType: 'npm',
  packageName: agent.name,
}

beforeEach(() => {
  setCliContext({
    cancelled: false,
    colorMode: 'never',
    interactive: false,
    logLevel: 'silent',
    outputMode: 'json',
    quiet: true,
    runId: 'core-installation-cli-test',
  })
})

describe('Core installation v1 projector', () => {
  it.each([
    [
      'already-satisfied',
      successValue({
        after: managedObservation(),
        before: managedObservation(),
        binding,
        changed: false,
        decision: 'already-satisfied',
        kind: 'apply',
      }),
      { changed: false, installed: true, warning: 'ALREADY_INSTALLED' },
    ],
    [
      'external-preserved',
      successValue({
        after: untrackedObservation(),
        before: untrackedObservation(),
        binding,
        changed: false,
        decision: 'external-preserved',
        kind: 'apply',
      }),
      { changed: false, installed: true, warning: 'UNTRACKED_EXISTING_INSTALL' },
    ],
    [
      'preview-install',
      successValue({
        before: missingObservation(),
        binding,
        decision: 'install',
        kind: 'preview',
        wouldChange: true,
      }),
      { changed: false, installed: false, warning: 'DRY_RUN' },
    ],
    [
      'preview-adopt',
      successValue({
        before: untrackedObservation(),
        binding,
        compatibility: { kind: 'adopt' },
        decision: 'external-preserved',
        kind: 'preview',
        wouldChange: true,
      }),
      { changed: false, installed: true, warning: 'DRY_RUN' },
    ],
    [
      'apply-adopt',
      successValue({
        after: managedObservation(),
        before: untrackedObservation(),
        binding,
        changed: true,
        compatibility: { kind: 'adopt' },
        decision: 'external-preserved',
        kind: 'apply',
      }),
      { changed: true, installed: true, warning: 'TRACKED_EXISTING_INSTALL' },
    ],
    [
      'apply-install',
      successValue({
        after: managedObservation(),
        before: missingObservation(),
        binding,
        changed: true,
        decision: 'install',
        kind: 'apply',
      }),
      { changed: true, installed: true, warning: undefined },
    ],
  ] as const)('projects %s without exposing Core internals', (_name, invocation, expected) => {
    const result = projectCoreInstallationOutcome('install', agent.name, invocation)

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ changed: expected.changed, installed: expected.installed })
    expect(result.warnings[0]?.code).toBe(expected.warning)
    expect(result).not.toHaveProperty('route')
    expect(result.meta).not.toHaveProperty('engine')
  })

  it('keeps stable unknown-agent, lock, state-read, and lifecycle failure categories', () => {
    const unknown = projectCoreInstallationOutcome('install', 'missing', {
      kind: 'success',
      value: { kind: 'agent-not-found', name: 'missing' },
    })
    const locked = projectCoreInstallationOutcome(
      'install',
      agent.name,
      domainFailure({
        cause: new ResourceLockError('agent lifecycle', '/isolated/agent-lifecycle.lock'),
        code: 'decision-indeterminate',
        phase: 'decide',
        reason: 'locked',
        retryable: false,
        sideEffect: 'none',
      }),
    )
    const stateRead = projectCoreInstallationOutcome(
      'ensure',
      agent.name,
      domainFailure({
        cause: new StateSchemaError('invalid state'),
        code: 'decision-indeterminate',
        phase: 'decide',
        reason: 'invalid state',
        retryable: false,
        sideEffect: 'none',
      }),
    )
    const recording = projectCoreInstallationOutcome(
      'ensure',
      agent.name,
      domainFailure({
        code: 'compensation-failed',
        originCode: 'recording-failed',
        phase: 'compensate',
        reason: 'recording and recovery failed',
        retryable: false,
        sideEffect: 'may-remain',
      }),
    )
    const providerTimeout = projectCoreInstallationOutcome('install', agent.name, {
      error: {
        code: 'timed-out',
        details: { phase: 'mutate', sideEffect: 'may-remain', timeoutMs: 37 },
        message: 'provider timed out',
        retryable: true,
      },
      kind: 'failure',
    })
    const recipeUnavailable = projectCoreInstallationOutcome(
      'install',
      agent.name,
      domainFailure({
        code: 'recipe-unavailable',
        phase: 'decide',
        reason: 'no available recipe',
        retryable: false,
        sideEffect: 'none',
      }),
    )

    expect(unknown.error).toMatchObject({ code: 'AGENT_NOT_FOUND', details: { input: 'missing' } })
    expect(locked.error).toMatchObject({
      code: 'RESOURCE_LOCKED',
      details: { lockPath: '/isolated/agent-lifecycle.lock', resource: 'agent lifecycle' },
    })
    expect(stateRead.error).toMatchObject({ code: 'STATE_READ_ERROR' })
    expect(recording.error).toMatchObject({
      code: 'INSTALL_FAILED',
      details: { lifecycle: 'state-write-failed' },
    })
    expect(providerTimeout.error).toMatchObject({ code: 'INSTALL_FAILED' })
    expect(recipeUnavailable.error).toEqual({ code: 'INSTALL_FAILED', message: 'Failed to install fixture-agent.' })
  })
})

describe('Core installation CLI session', () => {
  it('loads one executor for multiple targets and forwards CLI-only provider policy', async () => {
    setCliContext({
      cancelled: false,
      colorMode: 'never',
      interactive: false,
      logLevel: 'silent',
      outputMode: 'ndjson',
      quiet: true,
      runId: 'core-session-options',
      timeoutMs: 73,
    })
    const requests: CoreInstallationCompatibilityRequest[] = []
    const executor = fakeExecutor(async request => {
      requests.push(request)
      return { kind: 'success', value: { kind: 'agent-not-found', name: request.name } }
    })
    const loadExecutor = vi.fn(async () => executor)
    const session = createCoreInstallationCliSession('install', { loadExecutor })

    await session.execute('first')
    await session.execute('second')
    session.dispose()

    expect(loadExecutor).toHaveBeenCalledTimes(1)
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      mode: 'apply',
      operation: 'install',
      outputPolicy: 'stderr',
      providerTimeoutMs: 73,
    })
    expect(requests[0]?.resolveAdoption).toBeTypeOf('function')
  })

  it('keeps safe PATH adoption private and refuses ambiguous paths', async () => {
    let safeAdoption: Awaited<ReturnType<NonNullable<CoreInstallationCompatibilityRequest['resolveAdoption']>>>
    let ambiguousAdoption: Awaited<ReturnType<NonNullable<CoreInstallationCompatibilityRequest['resolveAdoption']>>>
    const executor = fakeExecutor(
      async request =>
        await runCoreInvocation(undefined, async context => {
          safeAdoption = await request.resolveAdoption?.(
            observed(present({ kind: 'untracked' }), {
              resolvedBinaryPath: '/home/fixture/.nvm/versions/node/v24/bin/fixture-agent',
            }),
            context,
          )
          ambiguousAdoption = await request.resolveAdoption?.(untrackedObservation(), context)
          return { kind: 'agent-not-found', name: request.name }
        }),
    )
    const session = createCoreInstallationCliSession('ensure', { loadExecutor: async () => executor })

    await session.execute(agent.name)
    session.dispose()

    expect(safeAdoption).toMatchObject({
      binding,
      installedState: { agentName: agent.name, installType: 'npm', packageName: agent.name },
    })
    expect(ambiguousAdoption).toBeUndefined()
  })

  it('maps a cached engine initialization failure without retrying or invoking another engine', async () => {
    const loadExecutor = vi.fn(async (): Promise<CoreInstallationCompatibilityExecutor> => {
      throw new Error('fixture loader failure')
    })
    const session = createCoreInstallationCliSession('ensure', { loadExecutor })

    const first = await session.execute(agent.name)
    const second = await session.execute(agent.name)
    session.dispose()

    expect(loadExecutor).toHaveBeenCalledTimes(1)
    expect(first.error).toMatchObject({ code: 'INSTALL_FAILED' })
    expect(second.error).toMatchObject({ code: 'INSTALL_FAILED' })
  })

  it('waits for Core cleanup to settle when CLI cancellation aborts an active invocation', async () => {
    const requestReady = deferred<CoreInstallationCompatibilityRequest>()
    const cleanupStarted = deferred<void>()
    const finishCleanup = deferred<void>()
    const executor = fakeExecutor(
      request =>
        new Promise(resolve => {
          requestReady.resolve(request)
          request.signal?.addEventListener(
            'abort',
            () => {
              void (async () => {
                cleanupStarted.resolve()
                await finishCleanup.promise
                resolve({
                  error: { code: 'cancelled', message: 'cancelled', retryable: false },
                  kind: 'failure',
                })
              })()
            },
            { once: true },
          )
        }),
    )
    const session = createCoreInstallationCliSession('install', { loadExecutor: async () => executor })

    const execution = session.execute(agent.name)
    await requestReady.promise
    const cancellation = cancelCliContextOperations()
    await cleanupStarted.promise
    expect(await Promise.race([cancellation.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending')

    finishCleanup.resolve()
    await cancellation
    await expect(execution).resolves.toMatchObject({ error: { code: 'CANCELLED' }, ok: false })
    session.dispose()
  })

  it('leaves TIMEOUT to the outer runtime and waits for Core cleanup before returning', async () => {
    setCliContext({
      cancelled: false,
      colorMode: 'never',
      interactive: false,
      logLevel: 'silent',
      outputMode: 'json',
      quiet: true,
      runId: 'core-outer-timeout',
      timeoutMs: 20,
    })
    const requestReady = deferred<CoreInstallationCompatibilityRequest>()
    const cleanupStarted = deferred<void>()
    const finishCleanup = deferred<void>()
    let cleanupFinished = false
    const executor = fakeExecutor(
      request =>
        new Promise(resolve => {
          requestReady.resolve(request)
          request.signal?.addEventListener(
            'abort',
            () => {
              void (async () => {
                cleanupStarted.resolve()
                await finishCleanup.promise
                cleanupFinished = true
                resolve({
                  error: { code: 'cancelled', message: 'cancelled', retryable: false },
                  kind: 'failure',
                })
              })()
            },
            { once: true },
          )
        }),
    )
    const session = createCoreInstallationCliSession('install', { loadExecutor: async () => executor })

    const runtime = executeCommandWithRuntime({
      action: 'install',
      run: () => session.execute(agent.name),
      target: { kind: 'agent', name: agent.name },
    })
    await requestReady.promise
    await cleanupStarted.promise
    expect(await Promise.race([runtime.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending')

    finishCleanup.resolve()
    const result = await runtime
    session.dispose()

    expect(cleanupFinished).toBe(true)
    expect(result.error).toMatchObject({ code: 'TIMEOUT', details: { timeoutMs: 20 } })
  })

  it('emits started immediately from the Core pre-side-effect hook and keeps route data out of the event', async () => {
    setCliContext({
      cancelled: false,
      colorMode: 'never',
      interactive: false,
      logLevel: 'silent',
      outputMode: 'ndjson',
      quiet: true,
      runId: 'core-started-event',
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const executor = fakeExecutor(async request => {
      request.onMutationStart?.({ before: missingObservation(), binding, decision: 'install' })
      return successValue({
        after: managedObservation(),
        before: missingObservation(),
        binding,
        changed: true,
        decision: 'install',
        kind: 'apply',
      })
    })
    const session = createCoreInstallationCliSession('install', { loadExecutor: async () => executor })

    const result = await session.execute(agent.name, { emitStartedEvent: true })
    session.dispose()

    expect(result.ok).toBe(true)
    expect(log).toHaveBeenCalledTimes(1)
    const event = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>
    expect(event).toMatchObject({ action: 'install', type: 'started' })
    expect(event).not.toHaveProperty('engine')
    expect(event).not.toHaveProperty('route')
    log.mockRestore()
  })
})

function fakeExecutor(
  execute: CoreInstallationCompatibilityExecutor['execute'],
): CoreInstallationCompatibilityExecutor {
  return { execute }
}

function successValue(
  value: Extract<CoreInstallationExecutionOutcome, { readonly kind: 'success' }>['value'],
): CoreInvocationOutcome<CoreInstallationExecutionOutcome> {
  return { kind: 'success', value: { kind: 'success', value } }
}

function domainFailure(
  error: Extract<CoreInstallationExecutionOutcome, { readonly kind: 'failed' }>['error'],
): CoreInvocationOutcome<CoreInstallationExecutionOutcome> {
  return { kind: 'success', value: { error, kind: 'failed' } }
}

function missingObservation(): CoreAgentObservation {
  return observed({
    drift: { kind: 'none' },
    kind: 'absent',
    observedAt: '2026-07-23T00:00:00.000Z',
    targetId: agent.name,
  })
}

function untrackedObservation(): CoreAgentObservation {
  return observed(present({ kind: 'untracked' }), { binding })
}

function managedObservation(): CoreAgentObservation {
  const receipt: LifecycleReceipt = {
    executableName: agent.binaryName,
    executablePath: '/isolated/bin/fixture-agent',
    kind: 'lifecycle-receipt',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    schemaVersion: 1,
    targetId: agent.name,
    verifiedAt: '2026-07-23T00:00:00.000Z',
    version: '1.0.0',
  }
  return observed(present({ kind: 'none' }), {
    binding,
    installedState,
    persistedBinding: binding,
    receipt,
  })
}

function present(drift: LifecycleObservation['drift']): Extract<LifecycleObservation, { kind: 'present' }> {
  return {
    drift,
    executablePath: '/isolated/bin/fixture-agent',
    kind: 'present',
    observedAt: '2026-07-23T00:00:00.000Z',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    targetId: agent.name,
    version: '1.0.0',
  }
}

function observed(
  observation: LifecycleObservation,
  overrides: Partial<CoreAgentObservation> = {},
): CoreAgentObservation {
  const executable = {
    path: observation.kind === 'present' ? observation.executablePath : undefined,
    present: observation.kind === 'present',
    version: observation.kind === 'present' ? observation.version : undefined,
  }
  return {
    agent,
    capabilities: [],
    catalogMethods: [binding],
    executable,
    methods: [{ type: 'npm' }],
    observation,
    pathExecutable: executable,
    ...overrides,
  }
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
