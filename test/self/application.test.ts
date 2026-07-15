import type { CacheLookup, RuntimeOutcome, RuntimePorts } from '../../src/runtime'
import type { SelfUpgradePlan } from '../../src/self'
import { describe, expect, it, vi } from 'vitest'
import { createInvocationContext } from '../../src/runtime'
import { runSelfUpgradeApplication } from '../../src/self/application'

describe('runSelfUpgradeApplication', () => {
  it.each([
    ['check', { check: true, dryRun: false }, 'update-available'],
    ['dry run', { check: false, dryRun: true }, 'update-available'],
    ['up to date', { check: false, dryRun: false }, 'up-to-date'],
    ['manual source', { check: false, dryRun: false }, 'manual-required'],
    ['unavailable check', { check: false, dryRun: false }, 'check-unavailable'],
  ] as const)('returns a plan without mutation for %s', async (_label, input, status) => {
    const context = createInvocationContext({ ports: createFakeRuntimePorts() })
    const plan = createPlan(status)
    const upgrade = vi.fn()

    await expect(
      runSelfUpgradeApplication({ ...input, updateChannel: 'stable' }, context, { plan: async () => plan, upgrade }),
    ).resolves.toEqual({ kind: 'planned', plan })
    expect(upgrade).not.toHaveBeenCalled()
  })

  it('passes invocation cache, lock, signal, and timeout into planning and mutation in order', async () => {
    const events: string[] = []
    const runtimePorts = createFakeRuntimePorts()
    const context = createInvocationContext({ ports: runtimePorts, timeoutMs: 1_500 })
    const plan = createPlan('update-available')
    const result = { installSource: 'npm' as const, newVersion: '1.1.0', success: true }

    const outcome = await runSelfUpgradeApplication({ check: false, dryRun: false, updateChannel: 'stable' }, context, {
      async plan(input) {
        events.push('plan')
        expect(input.context.signal).toBe(context.signal)
        expect(input.context.timeoutMs).toBe(1_500)
        expect(input.metadataCache).toBe(runtimePorts.cache)
        expect(input.networkPort).toBe(runtimePorts.network)
        expect(input.persistencePort).toBe(runtimePorts.persistence)
        expect(input.updateChannel).toBe('stable')
        return plan
      },
      async upgrade(receivedPlan, input) {
        events.push('upgrade')
        expect(receivedPlan).toBe(plan)
        expect(input.lockPort).toBe(runtimePorts.locks)
        expect(input.networkPort).toBe(runtimePorts.network)
        expect(input.processPort).toBe(runtimePorts.process)
        expect(input.signal).toBe(context.signal)
        expect(input.stdio).toEqual(['inherit', 'inherit', 'inherit'])
        expect(input.timeoutMs).toBe(1_500)
        return result
      },
    })

    expect(outcome).toEqual({ kind: 'executed', plan, result })
    expect(events).toEqual(['plan', 'upgrade'])
  })

  it('returns typed interruption without planning when already cancelled', async () => {
    const context = createInvocationContext({ ports: createFakeRuntimePorts() })
    await context.cancel('test cancellation')
    const plan = vi.fn()
    const upgrade = vi.fn()

    await expect(
      runSelfUpgradeApplication({ check: false, dryRun: false, updateChannel: 'stable' }, context, { plan, upgrade }),
    ).resolves.toEqual({
      error: { kind: 'cancelled', message: 'Self-upgrade invocation was cancelled.' },
      kind: 'interrupted',
    })
    expect(plan).not.toHaveBeenCalled()
    expect(upgrade).not.toHaveBeenCalled()
  })

  it('does not mutate when cancellation arrives after planning', async () => {
    const context = createInvocationContext({ ports: createFakeRuntimePorts() })
    const plan = createPlan('update-available')
    const upgrade = vi.fn()

    const outcome = await runSelfUpgradeApplication({ check: false, dryRun: false, updateChannel: 'stable' }, context, {
      async plan() {
        await context.cancel('after-plan')
        return plan
      },
      upgrade,
    })

    expect(outcome).toEqual({
      error: { kind: 'cancelled', message: 'Self-upgrade invocation was cancelled.' },
      kind: 'interrupted',
      plan,
    })
    expect(upgrade).not.toHaveBeenCalled()
  })
})

function createPlan(status: SelfUpgradePlan['status']): SelfUpgradePlan {
  return {
    facts: {
      canAutoUpdate: status !== 'manual-required',
      currentVersion: '1.0.0',
      executablePath: '/tmp/qtx',
      installSource: status === 'manual-required' ? 'source' : 'npm',
      packageRoot: '/tmp/quantex-cli',
      updateChannel: 'stable',
    },
    status,
    target: { packageTag: 'latest', targetVersion: status === 'check-unavailable' ? undefined : '1.1.0' },
    updateAvailable: status === 'update-available',
  }
}

function createFakeRuntimePorts(): RuntimePorts {
  return {
    cache: {
      read: async (): Promise<RuntimeOutcome<CacheLookup>> => success({ kind: 'miss' }),
      remove: async () => success(undefined),
      write: async () => success(undefined),
    },
    clock: { now: Date.now, sleep: unexpected },
    fileSystem: {
      makeDirectory: unexpected,
      readFile: unexpected,
      remove: unexpected,
      rename: unexpected,
      writeFile: unexpected,
    },
    locks: { acquire: unexpected },
    network: { request: unexpected },
    persistence: { load: unexpected, remove: unexpected, save: unexpected },
    process: { run: unexpected },
  }
}

async function unexpected(): Promise<RuntimeOutcome<never>> {
  return {
    error: { kind: 'failed', message: 'unexpected test port call' },
    kind: 'failure',
  }
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}
