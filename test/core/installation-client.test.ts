import type { AgentDefinition } from '../../src/agents/types'
import type { CoreInstallationExecutorPorts, CoreInstallationRecipe } from '../../src/core/installation-executor'
import type { CoreInvocationContext } from '../../src/core/invocation'
import type { CoreAgentObservation, CoreReadPorts } from '../../src/core/production-observation'
import type { LifecycleObservation, LifecycleReceipt } from '../../src/lifecycle/model'
import type { LifecycleProviderBinding } from '../../src/lifecycle/provider-binding'
import type { ProviderMutationEvidence, ProviderOutcome, ProviderVerification } from '../../src/providers/types'
import { describe, expect, it, vi } from 'vitest'
import { createQuantexClient } from '../../src/core/client'

const agent: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  lookupAliases: ['fixture'],
  name: 'fixture-agent',
  packages: { npm: '@fixture/agent' },
  platforms: { linux: [{ packageName: '@fixture/agent', type: 'npm' }] },
}

const binding: LifecycleProviderBinding = {
  providerId: 'npm',
  target: { binaryName: agent.binaryName, id: '@fixture/agent', kind: 'package' },
}

const source = {
  provider: 'npm',
  target: '@fixture/agent',
  targetKind: 'package',
} as const

const recipe: CoreInstallationRecipe = {
  binding,
  compensation: 'provider-uninstall',
  installedState: {
    agentName: agent.name,
    binaryName: agent.binaryName,
    installType: 'npm',
    packageName: binding.target.id,
  },
  ownership: 'created-on-success',
}

type ObservationInput = LifecycleObservation extends infer Observation
  ? Observation extends LifecycleObservation
    ? Omit<Observation, 'targetId'>
    : never
  : never

describe('public Core install and ensure client contract', () => {
  it('loads the mutation closure on the first mutation only and shares one loader promise per client', async () => {
    const mutation = mutationPorts([missingObservation(), missingObservation()])
    const loader = vi.fn(async () => mutation.ports)
    const reads = readPorts(managedObservation())
    const client = createQuantexClient({ configDir: '/isolated/client' }, reads, loader)

    await client.list()
    await client.inspect(agent.name)
    expect(loader).not.toHaveBeenCalled()

    const [installed, ensured] = await Promise.all([
      client.install(agent.name, { mode: 'preview' }),
      client.ensure(agent.name, { mode: 'preview' }),
    ])

    expect(installed).toMatchObject({ ok: true, value: { decision: 'install', mode: 'preview' } })
    expect(ensured).toMatchObject({ ok: true, value: { decision: 'install', mode: 'preview' } })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(mutation.operations).toEqual(['install', 'ensure'])
  })

  it('cancels while the mutation closure is still loading and never acquires a late mutation lock', async () => {
    const mutation = mutationPorts([missingObservation()])
    let resolvePorts!: (ports: CoreInstallationExecutorPorts) => void
    const pendingPorts = new Promise<CoreInstallationExecutorPorts>(resolve => {
      resolvePorts = resolve
    })
    const loader = vi.fn(() => pendingPorts)
    const client = createQuantexClient({}, readPorts(missingObservation()), loader)
    const controller = new AbortController()

    const resultPromise = client.install(agent.name, { signal: controller.signal })
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
    controller.abort('cancel during loader')

    await expect(resultPromise).resolves.toMatchObject({ error: { code: 'cancelled' }, ok: false })
    resolvePorts(mutation.ports)
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(mutation.events).toEqual([])
  })

  it('times out while the mutation closure is still loading and never starts a late mutation', async () => {
    const mutation = mutationPorts([missingObservation()])
    let resolvePorts!: (ports: CoreInstallationExecutorPorts) => void
    const pendingPorts = new Promise<CoreInstallationExecutorPorts>(resolve => {
      resolvePorts = resolve
    })
    const loader = vi.fn(() => pendingPorts)
    const client = createQuantexClient({}, readPorts(missingObservation()), loader)

    const result = await client.ensure(agent.name, { timeoutMs: 5 })

    expect(result).toMatchObject({ error: { code: 'timed-out' }, ok: false })
    resolvePorts(mutation.ports)
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(mutation.events).toEqual([])
  })

  it('defaults ensure to apply and returns a freshly projected managed after inspection', async () => {
    const before = missingObservation('2026-07-23T00:00:00.000Z')
    const verified = externalObservation('2026-07-23T00:00:01.000Z')
    const after = managedObservation('2026-07-23T00:00:02.000Z')
    const mutation = mutationPorts([before, verified, after])
    const client = createQuantexClient({}, readPorts(before), async () => mutation.ports)

    const result = await client.ensure(agent.name)

    expect(result).toEqual({
      ok: true,
      value: {
        after: {
          agent: descriptor,
          executablePath: '/resolved/fixture-agent',
          observedAt: '2026-07-23T00:00:02.000Z',
          source,
          status: 'managed',
          version: '2.0.0',
        },
        before: {
          agent: descriptor,
          observedAt: '2026-07-23T00:00:00.000Z',
          status: 'missing',
        },
        changed: true,
        decision: 'install',
        mode: 'apply',
        source,
      },
    })
    expect(mutation.events).toEqual([
      'lock',
      'observe',
      'resolve:ensure',
      'install',
      'verify',
      'observe',
      'record:prepare',
      'record:apply',
      'observe',
      'record:commit',
    ])
    expect(mutation.events).not.toContain('record:rollback')
  })

  it('freshly confirms a managed no-op instead of returning the decision snapshot as after', async () => {
    const before = managedObservation('2026-07-23T00:00:00.000Z')
    const after = managedObservation('2026-07-23T00:00:01.000Z')
    const mutation = mutationPorts([before, after])
    const client = createQuantexClient({}, readPorts(before), async () => mutation.ports)

    const result = await client.install(agent.name)

    expect(result).toMatchObject({
      ok: true,
      value: {
        after: { observedAt: '2026-07-23T00:00:01.000Z', status: 'managed' },
        before: { observedAt: '2026-07-23T00:00:00.000Z', status: 'managed' },
        changed: false,
        decision: 'already-satisfied',
        mode: 'apply',
        source,
      },
    })
    expect(mutation.events).toEqual(['lock', 'observe', 'observe'])
  })

  it('keeps preview free of a synthetic after inspection while projecting its source', async () => {
    const before = missingObservation()
    const mutation = mutationPorts([before])
    const client = createQuantexClient({}, readPorts(before), async () => mutation.ports)

    const result = await client.install(agent.name, { mode: 'preview' })

    expect(result).toEqual({
      ok: true,
      value: {
        before: {
          agent: descriptor,
          observedAt: '2026-07-23T00:00:00.000Z',
          status: 'missing',
        },
        decision: 'install',
        mode: 'preview',
        source,
        wouldChange: true,
      },
    })
    expect(result.ok && result.value).not.toHaveProperty('after')
    expect(mutation.events).toEqual(['observe', 'resolve:install'])
  })

  it.each([
    {
      decision: 'already-satisfied',
      observation: managedObservation(),
      wouldChange: false,
    },
    {
      decision: 'external-preserved',
      observation: externalObservation(),
      wouldChange: false,
    },
    {
      decision: 'install',
      observation: missingObservation(),
      wouldChange: true,
    },
    {
      decision: 'reinstall',
      observation: staleObservation(),
      wouldChange: true,
    },
  ] as const)('projects the $decision preview decision and public source only', async input => {
    const mutation = mutationPorts([input.observation])
    const client = createQuantexClient({}, readPorts(input.observation), async () => mutation.ports)

    const result = await client.ensure(agent.name, { mode: 'preview' })

    expect(result).toMatchObject({
      ok: true,
      value: {
        decision: input.decision,
        mode: 'preview',
        source,
        wouldChange: input.wouldChange,
      },
    })
    expect(JSON.stringify(result)).not.toContain('installedState')
    expect(JSON.stringify(result)).not.toContain('receipt')
  })

  it('maps an internal mutation failure to stable public phase and side-effect details without infrastructure leakage', async () => {
    const mutation = mutationPorts([missingObservation()], {
      installOutcome: {
        kind: 'failed',
        reason: 'installer failed after touching files',
        remediation: 'Inspect the provider installation.',
        retryable: false,
      },
    })
    const client = createQuantexClient({}, readPorts(missingObservation()), async () => mutation.ports)

    const result = await client.install(agent.name)

    expect(result).toEqual({
      error: {
        code: 'execution-failed',
        details: { phase: 'execute', sideEffect: 'may-remain' },
        message: 'installer failed after touching files',
        remediation: 'Inspect the provider installation.',
        retryable: false,
      },
      ok: false,
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('recipe')
    expect(serialized).not.toContain('installedState')
    expect(serialized).not.toContain('receipt')
    expect(serialized).not.toContain('ownership')
  })

  it('returns the stable agent-not-found result for a mutation target outside the catalog', async () => {
    const mutation = mutationPorts([undefined])
    const client = createQuantexClient({}, readPorts(undefined), async () => mutation.ports)

    const result = await client.install('unknown')

    expect(result).toEqual({
      error: {
        code: 'agent-not-found',
        details: { name: 'unknown' },
        message: 'Unknown agent: unknown',
        remediation: 'Use list() to discover registered agent names and aliases.',
        retryable: false,
      },
      ok: false,
    })
  })

  it('maps mutation-loader failures without reusing the inspection fallback message', async () => {
    const client = createQuantexClient({}, readPorts(missingObservation()), async () => {
      throw new Error('/private/provider-registry.ts failed to initialize internal ports')
    })

    await expect(client.install(agent.name)).resolves.toEqual({
      error: {
        code: 'execution-failed',
        details: { phase: 'decide', sideEffect: 'none' },
        message: 'Core mutation could not start safely.',
        remediation: 'Retry the request; if it continues to fail, verify the installed Core package.',
        retryable: false,
      },
      ok: false,
    })
  })

  it('preserves caller cancellation and timeout as public Core errors', async () => {
    const cancelledController = new AbortController()
    cancelledController.abort('stop before mutation')
    const cancelledMutation = mutationPorts([missingObservation()])
    const cancelledClient = createQuantexClient(
      {},
      readPorts(missingObservation()),
      async () => cancelledMutation.ports,
    )

    await expect(cancelledClient.ensure(agent.name, { signal: cancelledController.signal })).resolves.toMatchObject({
      error: { code: 'cancelled' },
      ok: false,
    })

    const timedMutation = mutationPorts([missingObservation()], { waitForAbortOnObserve: true })
    const timedClient = createQuantexClient({}, readPorts(missingObservation()), async () => timedMutation.ports)
    await expect(timedClient.install(agent.name, { timeoutMs: 5 })).resolves.toMatchObject({
      error: { code: 'timed-out', details: { timeoutMs: 5 } },
      ok: false,
    })
  })

  it('does not write stdout or stderr for mutation success and expected failure', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const mutation = mutationPorts([missingObservation(), undefined])
      const client = createQuantexClient({}, readPorts(missingObservation()), async () => mutation.ports)

      await client.install(agent.name, { mode: 'preview' })
      await client.ensure('unknown', { mode: 'preview' })

      expect(log).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
      expect(stdout).not.toHaveBeenCalled()
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
      error.mockRestore()
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})

const descriptor = {
  aliases: ['fixture'],
  binaryName: agent.binaryName,
  displayName: agent.displayName,
  homepage: agent.homepage,
  name: agent.name,
  platforms: ['linux'],
}

interface MutationPortsOptions {
  readonly installOutcome?: ProviderOutcome<ProviderMutationEvidence>
  readonly waitForAbortOnObserve?: boolean
}

function mutationPorts(
  initialObservations: readonly (CoreAgentObservation | undefined)[],
  options: MutationPortsOptions = {},
): {
  readonly events: string[]
  readonly operations: ('ensure' | 'install')[]
  readonly ports: CoreInstallationExecutorPorts
} {
  const events: string[] = []
  const operations: ('ensure' | 'install')[] = []
  const observations = [...initialObservations]
  const ports: CoreInstallationExecutorPorts = {
    async compensate(selected) {
      events.push('compensate')
      return successfulMutation(selected)
    },
    async install(selected) {
      events.push('install')
      return options.installOutcome ?? successfulMutation(selected)
    },
    async observe(_name, context) {
      events.push('observe')
      if (options.waitForAbortOnObserve) {
        await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }))
      }
      return observations.shift()
    },
    async prepareRecord() {
      events.push('record:prepare')
      return {
        async apply() {
          events.push('record:apply')
        },
        async commit() {
          events.push('record:commit')
        },
        async rollback() {
          events.push('record:rollback')
        },
      }
    },
    async resolveRecipe(input) {
      events.push(`resolve:${input.operation}`)
      operations.push(input.operation)
      return { kind: 'ready', recipe }
    },
    async verify() {
      events.push('verify')
      return successfulVerification()
    },
    async withMutationLock<T>(_name: string, _context: CoreInvocationContext, run: () => Promise<T>): Promise<T> {
      events.push('lock')
      return await run()
    },
  }
  return { events, operations, ports }
}

function readPorts(inspection: CoreAgentObservation | undefined): CoreReadPorts {
  return {
    inspectAgent: vi.fn(async () => inspection),
    listAgents: vi.fn(async () => [agent]),
  }
}

function successfulMutation(selected: CoreInstallationRecipe): ProviderOutcome<ProviderMutationEvidence> {
  return { kind: 'success', value: { evidence: [], target: selected.binding.target } }
}

function successfulVerification(): ProviderOutcome<ProviderVerification> {
  return { kind: 'success', value: { evidence: [], kind: 'satisfied' } }
}

function missingObservation(observedAt = '2026-07-23T00:00:00.000Z'): CoreAgentObservation {
  return createObservation({ drift: { kind: 'none' }, kind: 'absent', observedAt })
}

function externalObservation(observedAt = '2026-07-23T00:00:01.000Z'): CoreAgentObservation {
  return createObservation(
    {
      drift: { kind: 'untracked' },
      executablePath: '/bin/fixture-agent',
      kind: 'present',
      observedAt,
      providerId: binding.providerId,
      providerTargetId: binding.target.id,
      providerTargetKind: binding.target.kind,
      version: '2.0.0',
    },
    { binding, resolvedBinaryPath: '/resolved/fixture-agent' },
  )
}

function managedObservation(observedAt = '2026-07-23T00:00:02.000Z'): CoreAgentObservation {
  return createObservation(
    {
      drift: { kind: 'none' },
      executablePath: '/bin/fixture-agent',
      kind: 'present',
      observedAt,
      providerId: binding.providerId,
      providerTargetId: binding.target.id,
      providerTargetKind: binding.target.kind,
      version: '2.0.0',
    },
    {
      binding,
      installedState: recipe.installedState,
      persistedBinding: binding,
      receipt: lifecycleReceipt(observedAt),
      resolvedBinaryPath: '/resolved/fixture-agent',
    },
  )
}

function staleObservation(): CoreAgentObservation {
  return createObservation(
    {
      drift: { kind: 'recorded-absent' },
      kind: 'absent',
      observedAt: '2026-07-23T00:00:00.000Z',
    },
    {
      installedState: recipe.installedState,
      persistedBinding: binding,
      receipt: lifecycleReceipt('2026-07-22T00:00:00.000Z'),
    },
  )
}

function lifecycleReceipt(verifiedAt: string): LifecycleReceipt {
  return {
    executableName: agent.binaryName,
    executablePath: '/resolved/fixture-agent',
    kind: 'lifecycle-receipt',
    providerId: binding.providerId,
    providerTargetId: binding.target.id,
    providerTargetKind: binding.target.kind,
    schemaVersion: 1,
    targetId: agent.name,
    verifiedAt,
    version: '2.0.0',
  }
}

function createObservation(
  observation: ObservationInput,
  overrides: Partial<CoreAgentObservation> = {},
): CoreAgentObservation {
  const executable =
    observation.kind === 'present'
      ? { path: observation.executablePath, present: true, version: observation.version }
      : { present: false }
  return {
    agent,
    capabilities: [],
    catalogMethods: [binding],
    executable,
    methods: [{ packageName: binding.target.id, type: 'npm' }],
    observation: { ...observation, targetId: agent.name } as LifecycleObservation,
    pathExecutable: executable,
    ...overrides,
  }
}
