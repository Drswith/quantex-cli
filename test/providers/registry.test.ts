import type {
  FirstPartyProviderAdapterMap,
  ProviderAdapter,
  ProviderId,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers'
import { describe, expect, it } from 'vitest'
import {
  createProviderRegistry,
  defineFirstPartyProviderRegistry,
  firstPartyProviderIds,
  invokeProviderOperation,
} from '../../src/providers'

const context: ProviderOperationContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
}

const target: ProviderTarget = {
  id: '@example/agent',
  kind: 'package',
}

function success<T>(value: T): ProviderOutcome<T> {
  return { kind: 'success', value }
}

function createAdapter<Id extends ProviderId>(
  id: Id,
  operations: Partial<Omit<ProviderAdapter, 'id'>> = {},
): ProviderAdapter & { readonly id: Id } {
  return {
    availability: async () => success({ executable: id }),
    id,
    observe: async () => success({ kind: 'absent', target }),
    ...operations,
  }
}

describe('provider registry', () => {
  it('defines the closed first-party provider id set exactly once', () => {
    expect(firstPartyProviderIds).toEqual([
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
    ])
    expect(new Set(firstPartyProviderIds).size).toBe(firstPartyProviderIds.length)
    expect(Object.isFrozen(firstPartyProviderIds)).toBe(true)
  })

  it('derives capabilities only from implemented adapter operations', () => {
    const adapter = createAdapter('npm', {
      install: async () => success({ evidence: [], target }),
      resolveLatestVersion: async () => success({ version: '1.2.3' }),
      uninstall: async () => success({ evidence: [], target }),
      update: async () => success({ evidence: [], target }),
      verify: async () =>
        success({
          evidence: [{ kind: 'provider', value: `npm:${target.id}` }],
          kind: 'satisfied',
        }),
    })
    const registry = createProviderRegistry([adapter])

    expect(registry.getCapabilities('npm')).toEqual([
      'availability',
      'observe',
      'resolve-latest-version',
      'install',
      'update',
      'uninstall',
      'verify',
    ])
    expect(registry.get('npm')).toBe(adapter)
    expect(registry.list()).toEqual([adapter])
    expect(Object.isFrozen(registry.list())).toBe(true)
    expect('register' in registry).toBe(false)

    expect(createProviderRegistry([createAdapter('npm')]).getCapabilities('npm')).toEqual(['availability', 'observe'])
  })

  it('rejects duplicate adapter ids instead of silently replacing one', () => {
    expect(() => createProviderRegistry([createAdapter('npm'), createAdapter('npm')])).toThrow(
      'Duplicate provider adapter id: npm',
    )
  })

  it('requires the compile-time first-party registry to match each keyed adapter id', () => {
    const adapters = {
      binary: createAdapter('binary'),
      brew: createAdapter('brew'),
      bun: createAdapter('bun'),
      cargo: createAdapter('cargo'),
      deno: createAdapter('deno'),
      mise: createAdapter('mise'),
      npm: createAdapter('npm'),
      pip: createAdapter('pip'),
      script: createAdapter('script'),
      uv: createAdapter('uv'),
      winget: createAdapter('winget'),
    } satisfies FirstPartyProviderAdapterMap

    const compileTimeMismatch: FirstPartyProviderAdapterMap = {
      ...adapters,
      // @ts-expect-error The npm key must carry an adapter whose literal id is npm.
      npm: createAdapter('bun'),
    }
    expect(compileTimeMismatch.npm.id).toBe('bun')

    expect(
      defineFirstPartyProviderRegistry(adapters)
        .list()
        .map(adapter => adapter.id),
    ).toEqual(firstPartyProviderIds)

    expect(() =>
      defineFirstPartyProviderRegistry({
        ...adapters,
        npm: createAdapter('bun'),
      } as unknown as FirstPartyProviderAdapterMap),
    ).toThrow('Provider registry key npm does not match adapter id bun')
  })

  it('supports typed availability, observation, mutation, and verification outcomes', async () => {
    const failed: ProviderOutcome<never> = {
      command: ['npm', 'install', '-g', target.id],
      evidence: [{ kind: 'command', value: `npm install -g ${target.id}` }],
      exitCode: 1,
      kind: 'failed',
      reason: 'registry unavailable',
      remediation: 'retry with a reachable registry',
      retryable: true,
    }
    const adapter = createAdapter('npm', {
      install: async () => failed,
      uninstall: async () => ({ kind: 'cancelled', reason: 'user request' }),
      update: async () => ({ kind: 'timed-out', timeoutMs: context.timeoutMs ?? 0 }),
      verify: async () =>
        success({
          evidence: [{ kind: 'provider', value: `npm:${target.id}` }],
          kind: 'satisfied',
        }),
    })

    expect(await adapter.availability(context)).toEqual(success({ executable: 'npm' }))
    expect(await adapter.observe({ context, target })).toEqual(success({ kind: 'absent', target }))
    expect(await adapter.install?.({ context, target })).toBe(failed)
    expect(await adapter.update?.({ context, target })).toEqual({ kind: 'timed-out', timeoutMs: 5_000 })
    expect(await adapter.uninstall?.({ context, target })).toEqual({ kind: 'cancelled', reason: 'user request' })
    expect(await adapter.verify?.({ context, target })).toEqual(
      success({
        evidence: [{ kind: 'provider', value: 'npm:@example/agent' }],
        kind: 'satisfied',
      }),
    )
  })

  it('keeps unsupported, unavailable, and indeterminate outcomes distinct', () => {
    const outcomes: ProviderOutcome<never>[] = [
      {
        kind: 'unsupported',
        operation: 'resolve-latest-version',
        reason: 'provider does not expose a version endpoint',
      },
      {
        command: ['brew', '--version'],
        kind: 'unavailable',
        reason: 'brew executable was not found',
        retryable: false,
      },
      {
        evidence: [{ kind: 'provider', value: 'registry response could not be parsed' }],
        kind: 'indeterminate',
        reason: 'provider response was ambiguous',
      },
    ]

    expect(outcomes.map(outcome => outcome.kind)).toEqual(['unsupported', 'unavailable', 'indeterminate'])
  })

  it('maps missing target and batch operations through the production invocation boundary', async () => {
    const adapter = createAdapter('npm')

    expect(await invokeProviderOperation(adapter, 'resolve-latest-version', { context, target })).toEqual({
      kind: 'unsupported',
      operation: 'resolve-latest-version',
      reason: 'npm does not implement resolve-latest-version',
    })
    expect(await invokeProviderOperation(adapter, 'update-many', { context, targets: [target] })).toEqual({
      kind: 'unsupported',
      operation: 'update-many',
      reason: 'npm does not implement update-many',
    })
  })
})
