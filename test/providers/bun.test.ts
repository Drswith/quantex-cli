import type { ProviderOperationContext, ProviderTarget } from '../../src/providers'
import type { BunProviderDependencies } from '../../src/providers/adapters/bun'
import { describe, expect, it, vi } from 'vitest'
import { createBunProviderAdapter } from '../../src/providers/adapters/bun'
import { describeProviderConformance } from './conformance'

const target: ProviderTarget = {
  id: '@example/bun-agent',
  kind: 'package',
}

const context: ProviderOperationContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
}

const providerEvidence = { kind: 'provider', value: 'bun' } as const
const presentEvidence = { kind: 'package', value: `bun:${target.id}@1.2.3` } as const
const absentEvidence = { kind: 'package', value: `bun:${target.id}-absent:absent` } as const
const indeterminateEvidence = {
  kind: 'provider',
  value: `bun:${target.id}-unknown:presence-unknown`,
} as const
const failedCommand = ['bun', 'add', '-g', target.id] as const
const failedCommandEvidence = { kind: 'command', value: failedCommand.join(' ') } as const

function createDependencies(overrides: Partial<BunProviderDependencies> = {}): BunProviderDependencies {
  return {
    getInstalledVersion: vi.fn(async packageName => (packageName.includes('absent') ? undefined : '1.2.3')),
    install: vi.fn(async () => true),
    isAvailable: vi.fn(async () => true),
    probePackagePresence: vi.fn(async packageName => {
      if (packageName.includes('absent')) return 'absent'
      if (packageName.includes('unknown')) return 'unknown'
      return 'present'
    }),
    resolveLatestVersion: vi.fn(async () => '2.0.0'),
    uninstall: vi.fn(async () => true),
    update: vi.fn(async () => true),
    updateMany: vi.fn(async () => true),
    ...overrides,
  }
}

describeProviderConformance('Bun provider', () => {
  const dependencies = createDependencies({
    install: vi.fn(async () => false),
    isAvailable: vi.fn(async () => false),
    resolveLatestVersion: vi.fn(() => new Promise<undefined>(() => {})),
  })
  const adapter = createBunProviderAdapter(dependencies)

  return {
    adapter,
    cases: {
      absentEvidence,
      absentTarget: { ...target, id: `${target.id}-absent` },
      cancelled: (requestedAdapter, requestedContext, requestedTarget) =>
        requestedAdapter.update?.({ context: requestedContext, target: requestedTarget }),
      failed: {
        expected: {
          command: failedCommand,
          evidence: [providerEvidence, failedCommandEvidence],
          reason: `bun install failed for ${target.id}`,
          remediation: 'Review Bun output and retry the operation.',
          retryable: false,
        },
        invoke: (requestedAdapter, requestedContext, requestedTarget) =>
          requestedAdapter.install?.({ context: requestedContext, target: requestedTarget }),
      },
      indeterminate: {
        evidence: indeterminateEvidence,
        reason: `bun could not determine whether ${target.id}-unknown is installed`,
        target: { ...target, id: `${target.id}-unknown` },
      },
      present: {
        evidence: presentEvidence,
        target,
        version: '1.2.3',
      },
      timedOut: {
        invoke: (requestedAdapter, requestedContext, requestedTarget) =>
          requestedAdapter.resolveLatestVersion?.({ context: requestedContext, target: requestedTarget }),
        timeoutMs: 2,
      },
      unavailable: {
        invoke: requestedAdapter => requestedAdapter.availability(context),
        reason: 'bun executable is unavailable',
      },
      verificationEvidence: presentEvidence,
    },
    context,
    target,
  }
})

describe('Bun provider adapter', () => {
  it('projects install, update, update-many, and uninstall into typed command evidence', async () => {
    const dependencies = createDependencies()
    const adapter = createBunProviderAdapter(dependencies)
    const registry = 'https://registry.npmjs.org'
    const secondTarget = { ...target, id: '@example/other-agent' }

    expect(
      await adapter.install?.({
        context,
        options: { distTag: 'next', registry: `${registry}/` },
        target,
      }),
    ).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'command', value: `bun add -g --registry ${registry} ${target.id}@next` }],
        target,
      },
    })
    expect(dependencies.install).toHaveBeenCalledWith(target.id, 'next', registry)

    expect(
      await adapter.update?.({
        context,
        options: { distTag: 'beta', registry: `${registry}/`, updateStrategy: 'respect-semver' },
        target,
      }),
    ).toEqual({
      kind: 'success',
      value: {
        evidence: [
          providerEvidence,
          { kind: 'command', value: `bun update -g --registry ${registry} ${target.id}@beta` },
        ],
        target,
      },
    })
    expect(dependencies.update).toHaveBeenCalledWith(target.id, 'respect-semver', 'beta', registry)

    expect(
      await adapter.updateMany?.({
        context,
        options: { updateStrategy: 'latest-major' },
        targets: [target, secondTarget],
      }),
    ).toEqual({
      kind: 'success',
      value: [
        {
          evidence: [
            providerEvidence,
            { kind: 'command', value: `bun update -g --latest ${target.id} ${secondTarget.id}` },
          ],
          target,
        },
        {
          evidence: [
            providerEvidence,
            { kind: 'command', value: `bun update -g --latest ${target.id} ${secondTarget.id}` },
          ],
          target: secondTarget,
        },
      ],
    })
    expect(dependencies.updateMany).toHaveBeenCalledWith([target.id, secondTarget.id], 'latest-major')

    expect(await adapter.uninstall?.({ context, target })).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'command', value: `bun remove -g ${target.id}` }],
        target,
      },
    })
    expect(dependencies.uninstall).toHaveBeenCalledWith(target.id)
  })

  it('preserves dist-tag and normalized registry inputs while resolving the latest version', async () => {
    const dependencies = createDependencies()
    const adapter = createBunProviderAdapter(dependencies)

    expect(
      await adapter.resolveLatestVersion?.({
        context,
        options: { distTag: 'next', registry: 'https://registry.npmjs.org/' },
        target,
      }),
    ).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'package', value: `bun:${target.id}@next=2.0.0` }],
        version: '2.0.0',
      },
    })
    expect(dependencies.resolveLatestVersion).toHaveBeenCalledWith(target.id, 'next', 'https://registry.npmjs.org')

    expect(await adapter.install?.({ context, options: { distTag: 'latest' }, target })).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'command', value: `bun add -g ${target.id}@latest` }],
        target,
      },
    })
    expect(dependencies.install).toHaveBeenCalledWith(target.id, 'latest', undefined)
  })

  it('derives unsatisfied and indeterminate verification from fresh observations', async () => {
    const dependencies = createDependencies()
    const adapter = createBunProviderAdapter(dependencies)
    const absentTarget = { ...target, id: `${target.id}-absent` }
    const unknownTarget = { ...target, id: `${target.id}-unknown` }

    expect(await adapter.verify?.({ context, target: absentTarget })).toEqual({
      kind: 'success',
      value: {
        evidence: [{ kind: 'package', value: `bun:${absentTarget.id}:absent` }],
        kind: 'unsatisfied',
        reason: `${absentTarget.id} is not installed through bun`,
      },
    })
    expect(await adapter.verify?.({ context, target: unknownTarget })).toEqual({
      evidence: [{ kind: 'provider', value: `bun:${unknownTarget.id}:presence-unknown` }],
      kind: 'indeterminate',
      reason: `bun could not determine whether ${unknownTarget.id} is installed`,
    })
    expect(dependencies.probePackagePresence).toHaveBeenCalledTimes(2)
  })

  it('returns the exact timeout without waiting for a never-settling dependency', async () => {
    const install = vi.fn(() => new Promise<boolean>(() => {}))
    const adapter = createBunProviderAdapter(createDependencies({ install }))

    expect(
      await adapter.install?.({
        context: { ...context, timeoutMs: 3 },
        target,
      }),
    ).toEqual({ kind: 'timed-out', timeoutMs: 3 })
    expect(install).toHaveBeenCalledOnce()
  })

  it('does not invoke a dependency when the request signal is already aborted', async () => {
    const install = vi.fn(async () => true)
    const adapter = createBunProviderAdapter(createDependencies({ install }))
    const controller = new AbortController()
    controller.abort('user request')

    expect(await adapter.install?.({ context: { signal: controller.signal }, target })).toEqual({
      kind: 'cancelled',
      reason: 'user request',
    })
    expect(install).not.toHaveBeenCalled()
  })
})
