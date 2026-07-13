import type { ProviderAdapter, ProviderOutcome, ProviderRegistry } from '../../src/providers'
import { describe, expect, it, vi } from 'vitest'
import { getCommandContracts } from '../../src/command-contract/registry'
import { createProviderRegistry } from '../../src/providers'
import {
  getCommandCapabilitySnapshot,
  projectCommandCapabilitiesToV1Features,
} from '../../src/services/command-capabilities'
import {
  observeProviderSnapshot,
  projectProviderSnapshotToV1Installers,
} from '../../src/services/provider-observations'

describe('provider observation snapshot', () => {
  it('queries every registered adapter once and derives capabilities from the registry', async () => {
    const adapters = [
      adapter('bun', { kind: 'success', value: { executable: 'bun' } }, { update: true }),
      adapter('script'),
    ]
    const baseRegistry = createProviderRegistry(adapters)
    const registry: ProviderRegistry = {
      get: vi.fn(id => baseRegistry.get(id)),
      getCapabilities: vi.fn(id => baseRegistry.getCapabilities(id)),
      list: vi.fn(() => baseRegistry.list()),
    }

    const snapshot = await observeProviderSnapshot({
      context: { signal: new AbortController().signal },
      registry,
    })

    expect(registry.list).toHaveBeenCalledTimes(1)
    expect(registry.getCapabilities).toHaveBeenCalledTimes(2)
    expect(adapters[0].availability).toHaveBeenCalledTimes(1)
    expect(adapters[1].availability).toHaveBeenCalledTimes(1)
    expect(snapshot.map(entry => [entry.id, entry.capabilities])).toEqual([
      ['bun', ['availability', 'observe', 'update']],
      ['script', ['availability', 'observe']],
    ])
  })

  it.each([
    [{ kind: 'cancelled', reason: 'stop' }],
    [{ kind: 'timed-out', timeoutMs: 25 }],
    [{ kind: 'unavailable', reason: 'missing provider', retryable: true }],
  ] as const)('preserves typed availability outcome %o', async outcome => {
    const snapshot = await observeProviderSnapshot({
      context: { signal: new AbortController().signal, timeoutMs: 25 },
      registry: createProviderRegistry([adapter('npm', outcome)]),
    })

    expect(snapshot[0].availability).toEqual(outcome)
  })

  it('projects exactly the nine strict v1 installers without script or binary providers', async () => {
    const providers = [
      'bun',
      'npm',
      'brew',
      'cargo',
      'deno',
      'mise',
      'pip',
      'uv',
      'winget',
      'script',
      'binary',
    ] as const
    const snapshot = await observeProviderSnapshot({
      context: { signal: new AbortController().signal },
      registry: createProviderRegistry(providers.map(id => adapter(id))),
    })

    const projection = projectProviderSnapshotToV1Installers(snapshot, entry => entry.id)

    expect(Object.keys(projection)).toEqual(['brew', 'bun', 'cargo', 'deno', 'mise', 'npm', 'pip', 'uv', 'winget'])
    expect(projection).not.toHaveProperty('script')
    expect(projection).not.toHaveProperty('binary')
  })
})

describe('command capability snapshot', () => {
  it('derives the unchanged v1 feature projection from registered flags and effects', () => {
    const snapshot = getCommandCapabilitySnapshot(getCommandContracts())

    expect(snapshot.flagsByCommand.get('exec')).toContain('--install')
    expect(snapshot.effectsByCommand.get('upgrade')).toEqual(new Set(['filesystem', 'mutation', 'network', 'process']))
    expect(projectCommandCapabilitiesToV1Features(snapshot, { canAutoUpdateSelf: true })).toEqual({
      assumeYes: true,
      cacheBypass: true,
      cacheRefresh: true,
      channels: ['stable', 'beta'],
      colorModes: ['auto', 'always', 'never'],
      dryRun: true,
      execInstallPolicies: ['never', 'if-missing', 'always'],
      freshnessMetadata: true,
      idempotencyKey: true,
      logLevels: ['silent', 'error', 'warn', 'info', 'debug'],
      quietLogs: true,
      selfUpgrade: true,
      timeout: true,
    })
  })
})

function adapter(
  id: ProviderAdapter['id'],
  availability: ProviderOutcome<{ readonly executable?: string }> = {
    kind: 'unavailable',
    reason: `${id} unavailable`,
  },
  operations: { readonly update?: boolean } = {},
): ProviderAdapter {
  return {
    availability: vi.fn(async () => availability),
    id,
    observe: vi.fn(async request => ({ kind: 'success', value: { kind: 'absent', target: request.target } }) as const),
    ...(operations.update
      ? {
          update: vi.fn(async request => ({
            kind: 'success' as const,
            value: { evidence: [], target: request.target },
          })),
        }
      : {}),
  }
}
