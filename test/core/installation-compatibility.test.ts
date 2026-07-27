import type { AgentDefinition } from '../../src/agents/types'
import type { CoreInstallationExecutorPorts, CoreInstallationRecipe } from '../../src/core/installation-executor'
import type { CoreInvocationContext } from '../../src/core/invocation'
import type { CoreAgentObservation } from '../../src/core/production-observation'
import type { LifecycleObservation } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { ProviderProcessOperationContext } from '../../src/providers/internal-operation-context'
import type { ProviderOperationContext } from '../../src/providers/types'
import { describe, expect, it, vi } from 'vitest'
import { createCoreInstallationCompatibilityExecutor } from '../../src/core/installation-compatibility'

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

const recipe: CoreInstallationRecipe = {
  binding,
  compensation: 'provider-uninstall',
  installedState: {
    agentName: agent.name,
    binaryName: agent.binaryName,
    installType: 'npm',
    packageName: agent.name,
  },
  ownership: 'created-on-success',
}

describe('private Core installation compatibility executor', () => {
  it('caches production ports while applying each invocation output and provider-timeout policy', async () => {
    const observedContexts: CoreInvocationContext[] = []
    const providerContexts: ProviderOperationContext[] = []
    const ports = previewPorts({ observedContexts, providerContexts })
    const loadPorts = vi.fn(async () => ports)
    const executor = createCoreInstallationCompatibilityExecutor({ configDir: '/isolated/config', loadPorts })

    const first = await executor.execute({
      mode: 'preview',
      name: agent.name,
      operation: 'install',
      outputPolicy: 'stderr',
      providerTimeoutMs: 31,
    })
    const second = await executor.execute({
      mode: 'preview',
      name: agent.name,
      operation: 'ensure',
      outputPolicy: 'inherit',
      providerTimeoutMs: 47,
    })

    expect(first).toMatchObject({ kind: 'success', value: { kind: 'success' } })
    expect(second).toMatchObject({ kind: 'success', value: { kind: 'success' } })
    expect(loadPorts).toHaveBeenCalledTimes(1)
    expect(loadPorts).toHaveBeenCalledWith('/isolated/config')
    expect(observedContexts.map(context => context.timeoutMs)).toEqual([31, 47])
    expect(
      providerContexts.map(context => ({
        outputPolicy: (context as ProviderProcessOperationContext).outputPolicy,
        timeoutMs: context.timeoutMs,
      })),
    ).toEqual([
      { outputPolicy: 'stderr', timeoutMs: 31 },
      { outputPolicy: 'inherit', timeoutMs: 47 },
    ])
  })

  it('keeps compatibility adoption private and injectable per invocation', async () => {
    const ports = previewPorts({ observation: untrackedObservation() })
    const resolveAdoption = vi.fn(async () => ({ binding, installedState: recipe.installedState }))
    const executor = createCoreInstallationCompatibilityExecutor({
      loadPorts: async () => ports,
    })

    const outcome = await executor.execute({
      mode: 'preview',
      name: agent.name,
      operation: 'ensure',
      outputPolicy: 'discard',
      resolveAdoption,
    })

    expect(outcome).toMatchObject({
      kind: 'success',
      value: {
        kind: 'success',
        value: {
          compatibility: { kind: 'adopt' },
          decision: 'external-preserved',
          kind: 'preview',
          wouldChange: true,
        },
      },
    })
    expect(resolveAdoption).toHaveBeenCalledTimes(1)
  })

  it('keeps the bounded recovery timeout while forwarding CLI output policy to compensation', async () => {
    let compensationContext: ProviderOperationContext | undefined
    const ports: CoreInstallationExecutorPorts = {
      async compensate(_recipe, context) {
        compensationContext = context
        return { kind: 'success', value: { evidence: [], target: binding.target } }
      },
      async install() {
        return { kind: 'success', value: { evidence: [], target: binding.target } }
      },
      async observe() {
        return missingObservation()
      },
      async prepareRecord() {
        throw new Error('Unexpected state record.')
      },
      async resolveRecipe() {
        return { kind: 'ready', recipe }
      },
      async verify() {
        return {
          kind: 'success',
          value: { evidence: [], kind: 'unsatisfied', reason: 'fixture verification failure' },
        }
      },
      async withMutationLock(_name, _context, run) {
        return await run()
      },
    }
    const executor = createCoreInstallationCompatibilityExecutor({ loadPorts: async () => ports })

    const outcome = await executor.execute({
      mode: 'apply',
      name: agent.name,
      operation: 'install',
      outputPolicy: 'stderr',
      providerTimeoutMs: 60_000,
    })

    expect(outcome).toMatchObject({
      kind: 'success',
      value: { error: { code: 'verification-failed', sideEffect: 'compensated' }, kind: 'failed' },
    })
    expect(compensationContext?.timeoutMs).toBe(5_000)
    expect((compensationContext as ProviderProcessOperationContext | undefined)?.outputPolicy).toBe('stderr')
  })

  it('returns cancellation while ports load and never acquires a late mutation lock', async () => {
    const pendingPorts = deferred<CoreInstallationExecutorPorts>()
    let lockCalls = 0
    const lock: CoreInstallationExecutorPorts['withMutationLock'] = async (_name, _context, run) => {
      lockCalls += 1
      return await run()
    }
    const loadPorts = vi.fn(() => pendingPorts.promise)
    const executor = createCoreInstallationCompatibilityExecutor({ loadPorts })
    const controller = new AbortController()

    const execution = executor.execute({
      mode: 'apply',
      name: agent.name,
      operation: 'ensure',
      outputPolicy: 'discard',
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(loadPorts).toHaveBeenCalledTimes(1))
    controller.abort('stop while loading')

    await expect(execution).resolves.toMatchObject({
      error: { code: 'cancelled', details: { reason: 'stop while loading' } },
      kind: 'failure',
    })

    pendingPorts.resolve(previewPorts({ withMutationLock: lock }))
    await vi.waitFor(() => expect(lockCalls).toBe(0))
  })
})

interface PreviewPortsOptions {
  readonly observation?: CoreAgentObservation
  readonly observedContexts?: CoreInvocationContext[]
  readonly providerContexts?: ProviderOperationContext[]
  readonly withMutationLock?: CoreInstallationExecutorPorts['withMutationLock']
}

function previewPorts(options: PreviewPortsOptions = {}): CoreInstallationExecutorPorts {
  return {
    async compensate() {
      throw new Error('Unexpected compensation.')
    },
    async install() {
      throw new Error('Unexpected installation.')
    },
    async observe(_name, context) {
      options.observedContexts?.push(context)
      return options.observation ?? missingObservation()
    },
    async prepareRecord() {
      throw new Error('Unexpected state record.')
    },
    async resolveRecipe(input) {
      options.providerContexts?.push(input.context)
      return { kind: 'ready', recipe }
    },
    async verify() {
      throw new Error('Unexpected verification.')
    },
    withMutationLock:
      options.withMutationLock ??
      (async <T>(_name: string, _context: CoreInvocationContext, run: () => Promise<T>): Promise<T> => await run()),
  }
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
  return observed(
    {
      drift: { kind: 'untracked' },
      executablePath: '/isolated/bin/fixture-agent',
      kind: 'present',
      observedAt: '2026-07-23T00:00:00.000Z',
      providerId: binding.providerId,
      providerTargetId: binding.target.id,
      providerTargetKind: binding.target.kind,
      targetId: agent.name,
      version: '1.0.0',
    },
    { binding },
  )
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
