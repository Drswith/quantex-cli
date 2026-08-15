import { beforeEach, describe, expect, it, vi } from 'vitest'

const production = vi.hoisted(() => {
  let lockDepth = 0
  let scriptAdapter: { id: string; resolveLatestVersion?: unknown } | undefined
  const absent = new Set<string>()
  const manualScripts = new Set<string>()
  const upgraded = new Set<string>()
  const untracked = new Set<string>()
  const calls: string[] = []
  const writeReceipt = vi.fn(async (receipt: { targetId: string }) => {
    calls.push(`receipt:${receipt.targetId}`)
  })
  const update = vi.fn(async ({ target }: { target: { id: string } }) => {
    const agentName = target.id.replace('@scope/', '')
    calls.push(`update:${agentName}`)
    upgraded.add(agentName)
    return {
      kind: 'success' as const,
      value: {
        evidence: [],
        target: { binaryName: agentName, id: target.id, kind: 'package' as const },
      },
    }
  })
  const adapter = {
    availability: vi.fn(),
    id: 'npm' as const,
    observe: vi.fn(),
    resolveLatestVersion: vi.fn(async ({ target }: { target: { id: string } }) => {
      calls.push(`resolve:${target.id.replace('@scope/', '')}`)
      return { kind: 'success' as const, value: { version: '2.0.0' } }
    }),
    update,
    verify: vi.fn(),
  }
  const registry = {
    get: (providerId: string) => (providerId === 'script' ? scriptAdapter : adapter),
    getCapabilities: (providerId: string) =>
      providerId === 'script'
        ? (['availability', 'observe', 'install'] as const)
        : (['observe', 'resolve-latest-version', 'update', 'verify'] as const),
    list: () => (scriptAdapter ? [adapter, scriptAdapter] : [adapter]),
  }
  const withAgentLifecycleLock = vi.fn(async <T>(run: () => Promise<T>): Promise<T> => {
    if (lockDepth > 0) throw new Error('non-reentrant lifecycle lock acquired twice')
    lockDepth += 1
    calls.push('lock:start')
    try {
      return await run()
    } finally {
      calls.push('lock:end')
      lockDepth -= 1
    }
  })
  const createCliOperationContext = vi.fn(() => ({
    context: {
      registerCleanup: vi.fn(),
      signal: new AbortController().signal,
      timeoutMs: undefined,
    },
    dispose: vi.fn(),
    run: async <T>(run: () => Promise<T>) => run(),
  }))
  const resolveAgentObservation = vi.fn(async (agentName: string) => {
    calls.push(`observe:${agentName}:${upgraded.has(agentName) ? 'fresh' : 'initial'}`)
    if (absent.has(agentName)) {
      return {
        agent: { binaryName: agentName, displayName: agentName === 'alpha' ? 'Alpha' : 'Beta', name: agentName },
        capabilities: [],
        executable: { present: false },
        methods: [],
        observation: { drift: { kind: 'none' as const }, kind: 'absent' as const, targetId: agentName },
      }
    }
    const version = upgraded.has(agentName) ? '2.0.0' : '1.0.0'
    const isUntracked = untracked.has(agentName)
    const isManualScript = manualScripts.has(agentName)
    const providerId = isManualScript ? ('script' as const) : ('npm' as const)
    const providerTarget = isManualScript
      ? {
          binaryName: agentName,
          effect: { command: `curl https://example.com/${agentName} | bash`, kind: 'shell-script' as const },
          id: `script:${agentName}`,
          kind: 'script' as const,
        }
      : { binaryName: agentName, id: `@scope/${agentName}`, kind: 'package' as const }
    return {
      agent: { binaryName: agentName, displayName: agentName === 'alpha' ? 'Alpha' : 'Beta', name: agentName },
      ...(!isUntracked
        ? {
            binding: {
              providerId,
              target: providerTarget,
            },
          }
        : {}),
      capabilities: isManualScript
        ? (['availability', 'observe', 'install'] as const)
        : (['observe', 'resolve-latest-version', 'update', 'verify'] as const),
      executable: { path: `/bin/${agentName}`, present: true, version },
      ...(!isUntracked
        ? {
            installedState: isManualScript
              ? {
                  agentName,
                  command: `curl https://example.com/${agentName} | bash`,
                  installType: 'script' as const,
                }
              : {
                  agentName,
                  installType: 'npm' as const,
                  packageName: `@scope/${agentName}`,
                },
          }
        : {}),
      methods: isUntracked
        ? []
        : isManualScript
          ? [{ command: `curl https://example.com/${agentName} | bash`, type: 'script' as const }]
          : [{ packageName: `@scope/${agentName}`, type: 'npm' as const }],
      observation: {
        drift: { kind: isUntracked ? ('untracked' as const) : ('none' as const) },
        executablePath: `/bin/${agentName}`,
        kind: 'present' as const,
        ...(!isUntracked
          ? {
              providerId,
              providerTargetId: providerTarget.id,
              providerTargetKind: providerTarget.kind,
            }
          : {}),
        targetId: agentName,
        version,
      },
      ...(!isUntracked
        ? {
            persistedBinding: {
              providerId,
              target: providerTarget,
            },
            receipt: {
              executableName: agentName,
              executablePath: `/bin/${agentName}`,
              kind: 'lifecycle-receipt' as const,
              providerId,
              providerTargetId: providerTarget.id,
              providerTargetKind: providerTarget.kind,
              schemaVersion: 1 as const,
              targetId: agentName,
              verifiedAt: '2026-07-12T04:00:00.000Z',
              version: '1.0.0',
            },
          }
        : {}),
    }
  })
  const createProductionLifecycleObservationService = vi.fn((context: { signal: AbortSignal }) => {
    calls.push('observation-service:create')
    return { context, resolveAgentObservation }
  })
  const nestedResolveAgentObservation = vi.fn(async () => {
    throw new Error('nested lifecycle observation wrapper must not run')
  })

  return {
    calls,
    createCliOperationContext,
    createProductionLifecycleObservationService,
    isUpgraded: (agentName: string) => upgraded.has(agentName),
    markAbsent: (agentName: string) => absent.add(agentName),
    markManualScript: (agentName: string) => manualScripts.add(agentName),
    markUntracked: (agentName: string) => untracked.add(agentName),
    nestedResolveAgentObservation,
    registry,
    reset() {
      calls.length = 0
      lockDepth = 0
      absent.clear()
      manualScripts.clear()
      upgraded.clear()
      untracked.clear()
      createCliOperationContext.mockClear()
      createProductionLifecycleObservationService.mockClear()
      nestedResolveAgentObservation.mockClear()
      resolveAgentObservation.mockClear()
      update.mockClear()
      withAgentLifecycleLock.mockClear()
      writeReceipt.mockClear()
    },
    setScriptAdapter(value: { id: string; resolveLatestVersion?: unknown }) {
      scriptAdapter = value
    },
    update,
    withAgentLifecycleLock,
    writeReceipt,
  }
})

vi.mock('../../src/config', () => ({
  loadConfig: vi.fn(async () => ({ npmBunUpdateStrategy: 'latest-major' })),
}))
vi.mock('../../src/agents', () => ({
  getAllAgents: () => [
    { binaryName: 'beta', displayName: 'Beta', name: 'beta' },
    { binaryName: 'alpha', displayName: 'Alpha', name: 'alpha' },
  ],
}))
vi.mock('../../src/package-manager', () => ({
  withAgentLifecycleLock: production.withAgentLifecycleLock,
}))
vi.mock('../../src/providers', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/providers')>()
  production.setScriptAdapter(actual.firstPartyProviderRegistry.get('script')!)
  return { ...actual, firstPartyProviderRegistry: production.registry }
})
vi.mock('../../src/runtime/cli-operation-context', () => ({
  createCliOperationContext: production.createCliOperationContext,
}))
vi.mock('../../src/state', () => ({
  lifecycleReceiptStore: { write: production.writeReceipt },
}))
vi.mock('../../src/utils/user-output', () => ({
  isDryRunEnabled: () => false,
}))
vi.mock('../../src/services/lifecycle-observations', () => ({
  createProductionLifecycleObservationService: production.createProductionLifecycleObservationService,
  resolveAgentObservation: production.nestedResolveAgentObservation,
}))

import {
  createLifecycleUpdateBatchInvocation,
  createSingleAgentLifecycleUpdateInvocation,
  runLifecycleUpdateBatch,
  runSingleAgentLifecycleUpdate,
} from '../../src/services/lifecycle-updates-production'

describe('lifecycle update production composition', () => {
  beforeEach(() => production.reset())

  it('prepares a batch once and reuses the exact plan for one memoized execution', async () => {
    const invocation = createLifecycleUpdateBatchInvocation()

    const [firstPlan, secondPlan] = await Promise.all([invocation.prepare(), invocation.prepare()])
    expect(secondPlan).toBe(firstPlan)
    expect(production.calls.filter(call => call.endsWith(':initial'))).toEqual([
      'observe:alpha:initial',
      'observe:beta:initial',
    ])

    const [firstOutcome, secondOutcome] = await Promise.all([invocation.run(), invocation.run()])
    expect(secondOutcome).toBe(firstOutcome)
    expect(firstOutcome.plan).toBe(firstPlan)
    expect(invocation.getOutcome()).toBe(firstOutcome)
    expect(production.update).toHaveBeenCalledTimes(2)

    invocation.dispose()
    expect(production.createCliOperationContext.mock.results[0]?.value.dispose).toHaveBeenCalledOnce()
  })

  it('makes a disposed batch invocation terminal without interrupting an active preparation', async () => {
    const invocation = createLifecycleUpdateBatchInvocation()
    const preparing = invocation.prepare()
    const running = invocation.run()
    const operation = production.createCliOperationContext.mock.results[0]?.value

    invocation.dispose()
    expect(operation?.dispose).not.toHaveBeenCalled()
    await expect(preparing).resolves.toMatchObject({ kind: 'lifecycle-update-batch-plan' })
    await expect(running).rejects.toThrow('disposed')
    await expect(invocation.prepare()).rejects.toThrow('disposed')
    await expect(invocation.run()).rejects.toThrow('disposed')
    await expect(invocation.observe('alpha')).rejects.toThrow('disposed')
    expect(operation?.dispose).toHaveBeenCalledOnce()
    expect(production.update).not.toHaveBeenCalled()
  })

  it('prepares a single update once and reuses the exact plan for one memoized execution', async () => {
    const invocation = createSingleAgentLifecycleUpdateInvocation('alpha')

    const [firstPlanning, secondPlanning] = await Promise.all([invocation.prepare(), invocation.prepare()])

    expect(firstPlanning).toBe(secondPlanning)
    expect(firstPlanning.kind).toBe('planned')
    expect(production.calls.filter(call => call === 'observe:alpha:initial')).toHaveLength(1)
    expect(production.calls.filter(call => call === 'resolve:alpha')).toHaveLength(1)

    const [firstOutcome, secondOutcome] = await Promise.all([invocation.run(), invocation.run()])

    expect(firstOutcome).toBe(secondOutcome)
    expect(firstOutcome.kind).toBe('updated')
    if (firstPlanning.kind === 'planned' && firstOutcome.kind === 'updated') {
      expect(firstOutcome.plan).toBe(firstPlanning.planned)
    }
    expect(invocation.getOutcome()).toBe(firstOutcome)
    expect(production.update).toHaveBeenCalledTimes(1)
  })

  it('disposes an explicit single update invocation at most once', () => {
    const invocation = createSingleAgentLifecycleUpdateInvocation('alpha')
    const operation = production.createCliOperationContext.mock.results[0]?.value

    invocation.dispose()
    invocation.dispose()

    expect(operation?.dispose).toHaveBeenCalledOnce()
  })

  it('rejects new single update work after disposal', async () => {
    const invocation = createSingleAgentLifecycleUpdateInvocation('alpha')

    invocation.dispose()

    await expect(invocation.prepare()).rejects.toThrow('disposed')
    await expect(invocation.run()).rejects.toThrow('disposed')
    await expect(invocation.observe('alpha')).rejects.toThrow('disposed')
    expect(production.createProductionLifecycleObservationService).not.toHaveBeenCalled()
    expect(production.update).not.toHaveBeenCalled()
  })

  it('does not expose memoized preparation or execution through the terminal disposed API', async () => {
    const invocation = createSingleAgentLifecycleUpdateInvocation('alpha')

    await invocation.prepare()
    await invocation.run()
    invocation.dispose()

    await expect(invocation.prepare()).rejects.toThrow('disposed')
    await expect(invocation.run()).rejects.toThrow('disposed')
    expect(invocation.getOutcome()).toMatchObject({ kind: 'updated' })
  })

  it('defers disposal of active preparation and prevents it from continuing into mutation', async () => {
    const invocation = createSingleAgentLifecycleUpdateInvocation('alpha')
    const preparing = invocation.prepare()
    const running = invocation.run()
    const operation = production.createCliOperationContext.mock.results[0]?.value

    invocation.dispose()
    expect(operation?.dispose).not.toHaveBeenCalled()

    await expect(preparing).resolves.toMatchObject({ kind: 'planned' })
    await expect(running).rejects.toThrow('disposed')
    expect(operation?.dispose).toHaveBeenCalledOnce()
    expect(production.update).not.toHaveBeenCalled()
  })

  it('keeps the compatibility wrapper responsible for disposing its invocation', async () => {
    await runSingleAgentLifecycleUpdate('alpha')

    expect(production.createCliOperationContext.mock.results[0]?.value.dispose).toHaveBeenCalledOnce()
  })

  it('acquires the lifecycle lock once through update, fresh verification, and receipt persistence', async () => {
    const result = await runSingleAgentLifecycleUpdate('alpha')

    expect(result).toMatchObject({ kind: 'updated', verification: { kind: 'satisfied' } })
    expect(production.withAgentLifecycleLock).toHaveBeenCalledTimes(1)
    expect(production.createProductionLifecycleObservationService).toHaveBeenCalledOnce()
    expect(production.createProductionLifecycleObservationService).toHaveBeenCalledWith(
      production.createCliOperationContext.mock.results[0]?.value.context,
    )
    expect(production.nestedResolveAgentObservation).not.toHaveBeenCalled()
    expect(production.update).toHaveBeenCalledTimes(1)
    expect(production.writeReceipt).toHaveBeenCalledTimes(1)
    expect(production.calls).toEqual([
      'observation-service:create',
      'observe:alpha:initial',
      'resolve:alpha',
      'lock:start',
      'update:alpha',
      'observe:alpha:fresh',
      'receipt:alpha',
      'lock:end',
    ])
  })

  it('plans every canonical target before mutation and uses one invocation context', async () => {
    const result = await runLifecycleUpdateBatch()

    expect(result.results.map(target => [target.agentName, target.execution?.kind])).toEqual([
      ['alpha', 'updated'],
      ['beta', 'updated'],
    ])
    expect(production.createCliOperationContext).toHaveBeenCalledTimes(1)
    expect(production.createProductionLifecycleObservationService).toHaveBeenCalledOnce()
    expect(production.createProductionLifecycleObservationService).toHaveBeenCalledWith(
      production.createCliOperationContext.mock.results[0]?.value.context,
    )
    expect(production.nestedResolveAgentObservation).not.toHaveBeenCalled()
    expect(production.calls).toEqual([
      'observation-service:create',
      'observe:alpha:initial',
      'resolve:alpha',
      'observe:beta:initial',
      'resolve:beta',
      'lock:start',
      'update:alpha',
      'observe:alpha:fresh',
      'receipt:alpha',
      'lock:end',
      'lock:start',
      'update:beta',
      'observe:beta:fresh',
      'receipt:beta',
      'lock:end',
    ])
  })

  it('skips normally absent catalog agents while updating installed targets successfully', async () => {
    production.markAbsent('beta')

    const result = await runLifecycleUpdateBatch()

    expect(result.success).toBe(true)
    expect(result.plan.targets.map(target => target.agentName)).toEqual(['alpha'])
    expect(result.results.map(target => [target.agentName, target.execution?.kind])).toEqual([['alpha', 'updated']])
    expect(production.update).toHaveBeenCalledTimes(1)
    expect(production.calls).not.toContain('resolve:beta')
    expect(production.calls).not.toContain('update:beta')
  })

  it('preserves real untracked observation evidence as a non-mutating blocked batch result', async () => {
    production.markUntracked('alpha')

    const result = await runLifecycleUpdateBatch()

    expect(result.results[0]).toMatchObject({
      agentName: 'alpha',
      planning: {
        before: {
          methods: [],
          observation: { drift: { kind: 'untracked' } },
        },
        category: 'untracked',
        kind: 'blocked',
      },
    })
    expect(result.results[0]).not.toHaveProperty('execution')
    expect(result.results[0]?.planning).not.toHaveProperty('before.installedState')
    expect(result.results[1]).toMatchObject({ agentName: 'beta', execution: { kind: 'updated' } })
    expect(production.update).toHaveBeenCalledTimes(1)
    expect(production.calls).not.toContain('update:alpha')
  })

  it('keeps a tracked script source manual when its real adapter cannot resolve an update target', async () => {
    production.markManualScript('alpha')

    const result = await runLifecycleUpdateBatch()

    expect(result.results[0]).toMatchObject({
      agentName: 'alpha',
      planning: {
        before: {
          binding: { providerId: 'script', target: { id: 'script:alpha', kind: 'script' } },
          installedState: { installType: 'script' },
          observation: { drift: { kind: 'none' }, providerId: 'script' },
          persistedBinding: { providerId: 'script', target: { id: 'script:alpha', kind: 'script' } },
          receipt: { providerId: 'script', providerTargetId: 'script:alpha' },
        },
        category: 'manual-required',
        kind: 'blocked',
      },
    })
    expect(result.results[0]).not.toHaveProperty('execution')
    expect(result.results[1]).toMatchObject({ agentName: 'beta', execution: { kind: 'updated' } })
    expect(production.update).toHaveBeenCalledTimes(1)
    expect(production.calls).not.toContain('update:alpha')
    expect(production.calls).not.toContain('resolve:alpha')
  })
})
