import type { AgentDefinition } from '../../src/agents/types'
import type { CoreAgentObservation, CoreReadPorts } from '../../src/core/production-observation'
import { describe, expect, it, vi } from 'vitest'
import { createQuantexClient } from '../../src/core/client'

const agent: AgentDefinition = {
  binaryName: 'fixture-agent',
  displayName: 'Fixture Agent',
  homepage: 'https://example.com/fixture-agent',
  name: 'fixture-agent',
  platforms: {},
}

const missingObservation: CoreAgentObservation = {
  agent,
  capabilities: [],
  catalogMethods: [],
  executable: { present: false },
  methods: [],
  observation: {
    drift: { kind: 'none' },
    kind: 'absent',
    observedAt: '2026-07-22T00:00:00.000Z',
    targetId: agent.name,
  },
  pathExecutable: { present: false },
}

describe('Core invocation isolation', () => {
  it('isolates config and cancellation between concurrent clients', async () => {
    const firstStarted = deferred()
    const secondStarted = deferred()
    const releaseSecond = deferred()
    const seenConfigDirs: string[] = []
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        seenConfigDirs.push(context.configDir)
        if (context.configDir === '/tmp/quantex-core-first') {
          firstStarted.resolve()
          await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }))
          return missingObservation
        }
        secondStarted.resolve()
        await releaseSecond.promise
        return missingObservation
      },
      async listAgents() {
        return [agent]
      },
    }
    const first = createQuantexClient({ configDir: '/tmp/quantex-core-first' }, ports)
    const second = createQuantexClient({ configDir: '/tmp/quantex-core-second' }, ports)
    const firstController = new AbortController()
    const secondController = new AbortController()

    const firstResultPromise = first.inspect(agent.name, { signal: firstController.signal })
    const secondResultPromise = second.inspect(agent.name, { signal: secondController.signal })
    await Promise.all([firstStarted.promise, secondStarted.promise])
    firstController.abort('cancel-first-only')
    releaseSecond.resolve()
    const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise])

    expect(firstResult).toMatchObject({ error: { code: 'cancelled' }, ok: false })
    expect(secondResult).toMatchObject({ ok: true, value: { status: 'missing' } })
    expect(secondController.signal.aborted).toBe(false)
    expect(seenConfigDirs).toEqual(['/tmp/quantex-core-first', '/tmp/quantex-core-second'])
  })

  it('copies client configuration before a caller mutates its options object', async () => {
    const options = { configDir: '/tmp/quantex-core-original' }
    const observed = vi.fn()
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        observed(context.configDir)
        return missingObservation
      },
      async listAgents() {
        return [agent]
      },
    }
    const client = createQuantexClient(options, ports)
    options.configDir = '/tmp/quantex-core-mutated'

    await client.inspect(agent.name)

    expect(observed).toHaveBeenCalledWith('/tmp/quantex-core-original')
  })

  it('returns timeout without leaking it into a later invocation', async () => {
    let invocation = 0
    const ports: CoreReadPorts = {
      async inspectAgent() {
        invocation += 1
        if (invocation === 1) return new Promise<CoreAgentObservation>(() => undefined)
        return missingObservation
      },
      async listAgents() {
        return [agent]
      },
    }
    const client = createQuantexClient({}, ports)

    const timedOut = await client.inspect(agent.name, { timeoutMs: 10 })
    const next = await client.inspect(agent.name, { timeoutMs: 100 })

    expect(timedOut).toEqual({
      error: {
        code: 'timed-out',
        details: { timeoutMs: 10 },
        message: 'The Core request timed out after 10ms.',
        retryable: true,
      },
      ok: false,
    })
    expect(next).toMatchObject({ ok: true, value: { status: 'missing' } })
  })

  it('waits for registered cleanup before returning cancellation', async () => {
    const started = deferred()
    const cleanupStarted = deferred()
    const releaseCleanup = deferred()
    const controller = new AbortController()
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        context.registerCleanup({
          async cleanup() {
            cleanupStarted.resolve()
            await releaseCleanup.promise
          },
        })
        started.resolve()
        return new Promise<CoreAgentObservation>(() => undefined)
      },
      async listAgents() {
        return [agent]
      },
    }
    const resultPromise = createQuantexClient({}, ports).inspect(agent.name, { signal: controller.signal })
    await started.promise
    controller.abort('cancel-and-clean')
    await cleanupStarted.promise
    let returned = false
    void resultPromise.then(() => {
      returned = true
      return undefined
    })
    await Promise.resolve()

    expect(returned).toBe(false)
    releaseCleanup.resolve()
    const result = await resultPromise

    expect(result).toMatchObject({ error: { code: 'cancelled' }, ok: false })
  })

  it('waits for cleanup when work settles during cancellation', async () => {
    const cleanupStarted = deferred()
    const releaseCleanup = deferred()
    const controller = new AbortController()
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        context.registerCleanup({
          async cleanup() {
            cleanupStarted.resolve()
            await releaseCleanup.promise
          },
        })
        controller.abort('cancel-before-work-settles')
        return missingObservation
      },
      async listAgents() {
        return [agent]
      },
    }
    const resultPromise = createQuantexClient({}, ports).inspect(agent.name, { signal: controller.signal })
    await cleanupStarted.promise
    let returned = false
    void resultPromise.then(() => {
      returned = true
      return undefined
    })
    await Promise.resolve()

    expect(returned).toBe(false)
    releaseCleanup.resolve()

    await expect(resultPromise).resolves.toMatchObject({ error: { code: 'cancelled' }, ok: false })
  })

  it('waits for cleanup registered after cancellation was observed', async () => {
    const workStarted = deferred()
    const releaseWork = deferred()
    const cleanupStarted = deferred()
    const releaseCleanup = deferred()
    const controller = new AbortController()
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        workStarted.resolve()
        await releaseWork.promise
        context.registerCleanup({
          async cleanup() {
            cleanupStarted.resolve()
            await releaseCleanup.promise
          },
        })
        return missingObservation
      },
      async listAgents() {
        return [agent]
      },
    }
    const resultPromise = createQuantexClient({}, ports).inspect(agent.name, { signal: controller.signal })
    await workStarted.promise
    controller.abort('cancel-before-cleanup-registration')
    releaseWork.resolve()
    await cleanupStarted.promise
    let returned = false
    void resultPromise.then(() => {
      returned = true
      return undefined
    })
    await Promise.resolve()

    expect(returned).toBe(false)
    releaseCleanup.resolve()

    await expect(resultPromise).resolves.toMatchObject({ error: { code: 'cancelled' }, ok: false })
  })

  it.each([
    [{ kind: 'cancelled', reason: 'provider-cancelled' }, 'cancelled'],
    [{ kind: 'timed-out', timeoutMs: 7 }, 'timed-out'],
  ] as const)('cleans registered resources for provider-originated %s interruption', async (interruption, code) => {
    let cleaned = false
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        context.registerCleanup({
          cleanup() {
            cleaned = true
          },
        })
        throw interruption
      },
      async listAgents() {
        return [agent]
      },
    }

    const result = await createQuantexClient({}, ports).inspect(agent.name)

    expect(result).toMatchObject({ error: { code }, ok: false })
    expect(cleaned).toBe(true)
  })

  it('waits for an owned force cleanup that outlives the former grace window', async () => {
    const started = deferred()
    const forceStarted = deferred()
    const releaseForce = deferred()
    const controller = new AbortController()
    const ports: CoreReadPorts = {
      async inspectAgent(_name, context) {
        context.registerCleanup({
          cleanup: () => new Promise<void>(() => undefined),
          async force() {
            forceStarted.resolve()
            await releaseForce.promise
          },
        })
        started.resolve()
        return new Promise<CoreAgentObservation>(() => undefined)
      },
      async listAgents() {
        return [agent]
      },
    }
    const resultPromise = createQuantexClient({}, ports).inspect(agent.name, { signal: controller.signal })
    await started.promise
    controller.abort('force-cleanup')
    await forceStarted.promise
    let returned = false
    void resultPromise.then(() => {
      returned = true
      return undefined
    })

    await new Promise(resolve => setTimeout(resolve, 325))
    expect(returned).toBe(false)
    releaseForce.resolve()

    await expect(resultPromise).resolves.toMatchObject({ error: { code: 'cancelled' }, ok: false })
  })

  it('does not start work for an already-cancelled request', async () => {
    const controller = new AbortController()
    controller.abort('already-cancelled')
    const ports: CoreReadPorts = {
      inspectAgent: vi.fn(async () => missingObservation),
      listAgents: vi.fn(async () => [agent]),
    }

    const result = await createQuantexClient({}, ports).inspect(agent.name, { signal: controller.signal })

    expect(result).toMatchObject({ error: { code: 'cancelled' }, ok: false })
    expect(ports.inspectAgent).not.toHaveBeenCalled()
  })
})

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void
  const promise = new Promise<void>(complete => {
    resolve = complete
  })
  return { promise, resolve }
}
