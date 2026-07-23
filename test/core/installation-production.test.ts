import type { AgentDefinition } from '../../src/agents/types'
import type { CoreInstallationRecipe } from '../../src/core/installation-executor'
import type { CoreInstallationProductionDependencies } from '../../src/core/installation-production'
import type { CoreInvocationCleanup, CoreInvocationContext } from '../../src/core/invocation'
import type { CoreMutationRecipeCatalog } from '../../src/core/mutation-recipe-catalog'
import type { CoreAgentObservation, CoreReadPorts } from '../../src/core/production-observation'
import type { LifecycleObservation, LifecycleReceipt } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type {
  ProviderAdapter,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers/types'
import type { VersionedQuantexState } from '../../src/state/schema'
import type { StateDocumentPersistence } from '../../src/state/store'
import { describe, expect, it, vi } from 'vitest'
import { createProductionCoreInstallationPorts } from '../../src/core/installation-production'
import { runCoreInvocation } from '../../src/core/invocation'
import { createProviderRegistry } from '../../src/providers/registry'
import { createEmptyStateDocument } from '../../src/state/schema'
import { LifecycleStateStore } from '../../src/state/store'

const configDir = '/isolated/quantex-config'
const verifiedAt = '2026-07-23T01:02:03.000Z'

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
  target: {
    arguments: ['--global'],
    binaryName: agent.binaryName,
    id: 'fixture-agent',
    kind: 'package',
  },
}

const recipe: CoreInstallationRecipe = {
  binding,
  compensation: 'provider-uninstall',
  installedState: {
    agentName: agent.name,
    binaryName: agent.binaryName,
    installType: 'npm',
    packageInstallArgs: ['--global'],
    packageName: binding.target.id,
  },
  ownership: 'created-on-success',
}

const recipeCatalog: CoreMutationRecipeCatalog = []

describe('production Core installation ports', () => {
  it('uses injected read dependencies and the exact config directory without invoking the production lazy loader', async () => {
    const invocation = testInvocation()
    const inspected = missingObservation()
    const inspectAgent = vi.fn(async () => inspected)
    const ports = createPorts({
      readPorts: { inspectAgent, listAgents: async () => [agent] },
    })

    await expect(ports.observe(agent.name, invocation.context)).resolves.toBe(inspected)
    expect(inspectAgent).toHaveBeenCalledWith(
      agent.name,
      expect.objectContaining({ configDir, signal: invocation.context.signal }),
    )
  })

  it('acquires the global lifecycle lock with the stable identity and exact config directory', async () => {
    const events: string[] = []
    const locks = lockHarness(events)
    const invocation = testInvocation()
    const ports = createPorts({ acquireResourceLock: locks.acquire })

    const value = await ports.withMutationLock(agent.name, invocation.context, async () => {
      events.push('callback')
      return 'completed'
    })

    expect(value).toBe('completed')
    expect(locks.acquire).toHaveBeenCalledTimes(1)
    expect(locks.acquire).toHaveBeenCalledWith(configDir, {
      resource: 'agent lifecycle',
      scope: ['agent-lifecycle'],
    })
    expect(events).toEqual(['lock:agent-lifecycle:acquire', 'callback', 'lock:agent-lifecycle:release'])
    expect(invocation.cleanups).toHaveLength(0)
  })

  it('nests the state lock under lifecycle, writes state and receipt together, then releases state before lifecycle', async () => {
    const events: string[] = []
    const locks = lockHarness(events)
    const persistence = memoryPersistence(createEmptyStateDocument(), events)
    const invocation = testInvocation()
    const before = missingObservation()
    const verified = untrackedObservation()
    const ports = createPorts({
      acquireResourceLock: locks.acquire,
      clock: () => 'fallback-clock-must-not-win',
      stateStore: new LifecycleStateStore(persistence.port),
    })

    await ports.withMutationLock(agent.name, invocation.context, async () => {
      events.push('callback:start')
      const record = await ports.prepareRecord({ before, context: invocation.context, recipe, verified })
      events.push('record:prepared')
      await record.apply()
      events.push('record:applied')
      await record.commit()
      events.push('record:committed')
    })

    expect(locks.acquire).toHaveBeenNthCalledWith(1, configDir, {
      resource: 'agent lifecycle',
      scope: ['agent-lifecycle'],
    })
    expect(locks.acquire).toHaveBeenNthCalledWith(2, configDir, {
      resource: 'state',
      scope: ['state'],
    })
    expect(persistence.saved).toHaveLength(1)
    expect(persistence.value.installedAgents[agent.name]).toEqual(recipe.installedState)

    const receipt = persistence.value.lifecycleReceipts[agent.name]
    expect(receipt).toEqual({
      executableName: agent.binaryName,
      executablePath: '/real/fixture-agent',
      kind: 'lifecycle-receipt',
      providerId: binding.providerId,
      providerTargetId: binding.target.id,
      providerTargetKind: binding.target.kind,
      schemaVersion: 1,
      targetId: agent.name,
      verifiedAt,
      version: '2.3.4',
    })
    expect(receipt?.providerId).toBe(
      verified.observation.kind === 'present' ? verified.observation.providerId : undefined,
    )
    expect(receipt?.providerTargetId).toBe(
      verified.observation.kind === 'present' ? verified.observation.providerTargetId : undefined,
    )
    expect(receipt?.providerTargetKind).toBe(
      verified.observation.kind === 'present' ? verified.observation.providerTargetKind : undefined,
    )
    expect(events.indexOf('lock:state:acquire')).toBeGreaterThan(events.indexOf('callback:start'))
    expect(events.indexOf('lock:state:release')).toBeGreaterThan(events.indexOf('state:save'))
    expect(events.indexOf('lock:state:release')).toBeLessThan(events.indexOf('lock:agent-lifecycle:release'))
    expect(invocation.cleanups).toHaveLength(0)
  })

  it('fails closed without writing when recorded evidence changes before the state lock is established', async () => {
    const events: string[] = []
    const locks = lockHarness(events)
    const persistence = memoryPersistence(createEmptyStateDocument(), events)
    const invocation = testInvocation()
    const before = missingObservation()
    const ports = createPorts({
      acquireResourceLock: locks.acquire,
      stateStore: new LifecycleStateStore(persistence.port),
    })
    persistence.replace({
      ...createEmptyStateDocument(),
      installedAgents: {
        [agent.name]: { agentName: agent.name, installType: 'bun', packageName: 'concurrent-agent' },
      },
      lifecycleReceipts: {
        [agent.name]: receiptFor('bun', 'concurrent-agent'),
      },
    })

    await expect(
      ports.withMutationLock(agent.name, invocation.context, async () => {
        await ports.prepareRecord({ before, context: invocation.context, recipe, verified: untrackedObservation() })
      }),
    ).rejects.toThrow('Recorded agent evidence changed')

    expect(persistence.saved).toHaveLength(0)
    expect(events).toContain('lock:state:acquire')
    expect(events).toContain('lock:state:release')
    expect(events.indexOf('lock:state:release')).toBeLessThan(events.indexOf('lock:agent-lifecycle:release'))
    expect(invocation.cleanups).toHaveLength(0)
  })

  it('does not release the lifecycle lock on cancellation until the callback recovery terminal settles', async () => {
    const events: string[] = []
    const locks = lockHarness(events)
    const callbackStarted = deferred<void>()
    const recoveryTerminal = deferred<void>()
    const controller = new AbortController()
    const ports = createPorts({ acquireResourceLock: locks.acquire })

    const invocation = runCoreInvocation({ signal: controller.signal }, context =>
      ports.withMutationLock(agent.name, context, async () => {
        events.push('callback:start')
        callbackStarted.resolve()
        await recoveryTerminal.promise
        events.push('callback:recovery-terminal')
      }),
    )
    await callbackStarted.promise
    controller.abort('stop lifecycle')
    await Promise.resolve()

    expect(events).not.toContain('lock:agent-lifecycle:release')
    expect(await Promise.race([invocation.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending')

    recoveryTerminal.resolve()
    const outcome = await invocation

    expect(outcome).toMatchObject({ error: { code: 'cancelled' }, kind: 'failure' })
    expect(events.indexOf('callback:recovery-terminal')).toBeLessThan(events.indexOf('lock:agent-lifecycle:release'))
    expect(events.filter(event => event === 'lock:agent-lifecycle:release')).toHaveLength(1)
  })

  it('normalizes install and verify provider rejections without leaking promise rejection', async () => {
    const ports = createPorts({
      providerRegistry: registry({
        async install() {
          throw new Error('install exploded')
        },
        async verify() {
          throw new Error('verify exploded')
        },
      }),
    })
    const context = providerContext()

    await expect(ports.install(recipe, context)).resolves.toEqual({
      kind: 'failed',
      reason: 'install provider rejected: install exploded',
      retryable: false,
    })
    await expect(ports.verify(recipe, context)).resolves.toEqual({
      kind: 'failed',
      reason: 'verify provider rejected: verify exploded',
      retryable: false,
    })
  })

  it('accepts compensation only after uninstall is followed by a fresh exact absent observation', async () => {
    const events: string[] = []
    const ports = createPorts({
      providerRegistry: registry({
        async observe({ target }) {
          events.push('observe')
          return { kind: 'success', value: { kind: 'absent', target } }
        },
        async uninstall({ target }) {
          events.push('uninstall')
          return successfulMutation(target)
        },
      }),
    })

    await expect(ports.compensate(recipe, providerContext())).resolves.toEqual(successfulMutation(binding.target))
    expect(events).toEqual(['uninstall', 'observe'])
  })

  it.each([
    ['present', { kind: 'present', target: binding.target }],
    [
      'different target',
      {
        kind: 'absent',
        target: { ...binding.target, arguments: ['--different'] },
      },
    ],
  ] as const)('fails compensation when the fresh observation is %s', async (_label, observation) => {
    const events: string[] = []
    const ports = createPorts({
      providerRegistry: registry({
        async observe() {
          events.push('observe')
          return { kind: 'success', value: observation }
        },
        async uninstall({ target }) {
          events.push('uninstall')
          return successfulMutation(target)
        },
      }),
    })

    const outcome = await ports.compensate(recipe, providerContext())

    expect(outcome).toMatchObject({
      kind: 'failed',
      remediation: expect.stringContaining('remove the selected provider target manually'),
      retryable: false,
    })
    expect(events).toEqual(['uninstall', 'observe'])
  })
})

type AcquireResourceLock = NonNullable<CoreInstallationProductionDependencies['acquireResourceLock']>

function createPorts(
  overrides: Partial<CoreInstallationProductionDependencies> = {},
): ReturnType<typeof createProductionCoreInstallationPorts> {
  return createProductionCoreInstallationPorts({
    configDir,
    platform: 'linux',
    providerRegistry: registry(),
    readPorts: readPorts(),
    recipeCatalog,
    stateStore: new LifecycleStateStore(memoryPersistence(createEmptyStateDocument()).port),
    ...overrides,
  })
}

function registry(overrides: Partial<ProviderAdapter> = {}) {
  const adapter: ProviderAdapter = {
    async availability() {
      return { kind: 'success', value: { executable: 'npm' } }
    },
    id: 'npm',
    async observe({ target }) {
      return { kind: 'success', value: { kind: 'absent', target } }
    },
    ...overrides,
  }
  return createProviderRegistry([adapter])
}

function readPorts(observation: CoreAgentObservation = missingObservation()): CoreReadPorts {
  return {
    async inspectAgent() {
      return observation
    },
    async listAgents() {
      return [agent]
    },
  }
}

function lockHarness(events: string[]): {
  readonly acquire: ReturnType<typeof vi.fn<AcquireResourceLock>>
} {
  const acquire = vi.fn<AcquireResourceLock>(async (_lockConfigDir, options) => {
    const identity = options.scope.join('/')
    events.push(`lock:${identity}:acquire`)
    return async () => {
      events.push(`lock:${identity}:release`)
    }
  })
  return { acquire }
}

function testInvocation(signal = new AbortController().signal): {
  readonly cleanups: CoreInvocationCleanup[]
  readonly context: CoreInvocationContext
} {
  const cleanups: CoreInvocationCleanup[] = []
  return {
    cleanups,
    context: {
      registerCleanup(cleanup) {
        cleanups.push(cleanup)
        return () => {
          const index = cleanups.indexOf(cleanup)
          if (index >= 0) cleanups.splice(index, 1)
        }
      },
      setInterruptionDetails() {},
      signal,
    },
  }
}

function providerContext(): ProviderOperationContext {
  return { signal: new AbortController().signal, timeoutMs: 100 }
}

function missingObservation(): CoreAgentObservation {
  return observed(absent({ kind: 'none' }))
}

function untrackedObservation(): CoreAgentObservation {
  return observed(present({ kind: 'untracked' }), {
    binding,
    resolvedBinaryPath: '/real/fixture-agent',
  })
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
    methods: [{ packageInstallArgs: ['--global'], type: 'npm' }],
    observation,
    pathExecutable: executable,
    ...overrides,
  }
}

function present(drift: LifecycleObservation['drift']): Extract<LifecycleObservation, { kind: 'present' }> {
  return {
    drift,
    executablePath: '/shim/fixture-agent',
    kind: 'present',
    observedAt: verifiedAt,
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    targetId: agent.name,
    version: '2.3.4',
  }
}

function absent(drift: LifecycleObservation['drift']): Extract<LifecycleObservation, { kind: 'absent' }> {
  return {
    drift,
    kind: 'absent',
    observedAt: '2026-07-23T00:00:00.000Z',
    targetId: agent.name,
  }
}

function receiptFor(providerId: string, providerTargetId: string): LifecycleReceipt {
  return {
    kind: 'lifecycle-receipt',
    providerId,
    providerTargetId,
    providerTargetKind: 'package',
    schemaVersion: 1,
    targetId: agent.name,
    verifiedAt,
  }
}

function successfulMutation(target: ProviderTarget): ProviderOutcome<{ evidence: []; target: ProviderTarget }> {
  return { kind: 'success', value: { evidence: [], target } }
}

function memoryPersistence(
  initial: VersionedQuantexState,
  events: string[] = [],
): {
  readonly port: StateDocumentPersistence
  replace(document: VersionedQuantexState): void
  readonly saved: VersionedQuantexState[]
  readonly value: VersionedQuantexState
} {
  let value = clone(initial)
  const saved: VersionedQuantexState[] = []
  return {
    port: {
      async load() {
        events.push('state:load')
        return clone(value)
      },
      async save(document) {
        events.push('state:save')
        value = clone(document)
        saved.push(value)
      },
    },
    replace(document) {
      value = clone(document)
    },
    saved,
    get value() {
      return value
    },
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
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
