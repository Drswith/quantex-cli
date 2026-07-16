import type { ProviderOperationContext, ProviderTarget } from '../../src/providers'
import type { NpmProviderDependencies } from '../../src/providers/adapters/npm'
import { describe, expect, it, vi } from 'vitest'
import { createNpmProviderAdapter } from '../../src/providers/adapters/npm'
import { describeProviderConformance } from './conformance'

const target: ProviderTarget = {
  id: '@example/npm-agent',
  kind: 'package',
}

const context: ProviderOperationContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
}

const providerEvidence = { kind: 'provider', value: 'npm' } as const
const presentEvidence = { kind: 'package', value: `npm:${target.id}@1.2.3` } as const
const absentEvidence = { kind: 'package', value: `npm:${target.id}-absent:absent` } as const
const indeterminateEvidence = {
  kind: 'provider',
  value: `npm:${target.id}-unknown:presence-unknown`,
} as const
const failedCommand = ['npm', 'install', '-g', target.id] as const
const failedCommandEvidence = { kind: 'command', value: failedCommand.join(' ') } as const

function mutation(success = true) {
  return vi.fn(async () =>
    success
      ? ({ kind: 'success', value: undefined } as const)
      : ({ kind: 'failed', reason: '', retryable: false } as const),
  )
}

function pendingMutation() {
  return vi.fn(() => new Promise<never>(() => {}))
}

function createDependencies(overrides: Partial<NpmProviderDependencies> = {}): NpmProviderDependencies {
  return {
    getInstalledVersion: vi.fn(async packageName => (packageName.includes('absent') ? undefined : '1.2.3')),
    install: mutation(),
    isAvailable: vi.fn(async () => true),
    probePackagePresence: vi.fn(async packageName => {
      if (packageName.includes('absent')) return 'absent'
      if (packageName.includes('unknown')) return 'unknown'
      return 'present'
    }),
    resolveLatestVersion: vi.fn(async () => '2.0.0'),
    uninstall: mutation(),
    update: mutation(),
    updateMany: mutation(),
    ...overrides,
  }
}

describeProviderConformance('npm provider', () => {
  const dependencies = createDependencies({
    install: mutation(false),
    isAvailable: vi.fn(async () => false),
    resolveLatestVersion: vi.fn(() => new Promise<undefined>(() => {})),
  })
  const adapter = createNpmProviderAdapter(dependencies)

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
          reason: `npm install failed for ${target.id}`,
          remediation: 'Review npm output and retry the operation.',
          retryable: false,
        },
        invoke: (requestedAdapter, requestedContext, requestedTarget) =>
          requestedAdapter.install?.({ context: requestedContext, target: requestedTarget }),
      },
      indeterminate: {
        evidence: indeterminateEvidence,
        reason: `npm could not determine whether ${target.id}-unknown is installed`,
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
        reason: 'npm executable is unavailable',
      },
      verificationEvidence: presentEvidence,
    },
    context,
    target,
  }
})

describe('npm provider adapter', () => {
  it('projects install, update, update-many, and uninstall into typed command evidence', async () => {
    const dependencies = createDependencies()
    const adapter = createNpmProviderAdapter(dependencies)
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
        evidence: [
          providerEvidence,
          { kind: 'command', value: `npm install -g ${target.id}@next --registry ${registry}` },
        ],
        target,
      },
    })
    expect(dependencies.install).toHaveBeenCalledWith(target.id, 'next', registry, context)

    expect(
      await adapter.update?.({
        context,
        options: { distTag: 'beta', registry: `${registry}/`, updateStrategy: 'respect-semver' },
        target,
      }),
    ).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'command', value: `npm update -g ${target.id} --registry ${registry}` }],
        target,
      },
    })
    expect(dependencies.update).toHaveBeenCalledWith(target.id, 'respect-semver', 'beta', registry, context)

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
            { kind: 'command', value: `npm install -g ${target.id}@latest ${secondTarget.id}@latest` },
          ],
          target,
        },
        {
          evidence: [
            providerEvidence,
            { kind: 'command', value: `npm install -g ${target.id}@latest ${secondTarget.id}@latest` },
          ],
          target: secondTarget,
        },
      ],
    })
    expect(dependencies.updateMany).toHaveBeenCalledWith([target.id, secondTarget.id], 'latest-major', context)

    expect(await adapter.uninstall?.({ context, target })).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'command', value: `npm uninstall -g ${target.id}` }],
        target,
      },
    })
    expect(dependencies.uninstall).toHaveBeenCalledWith(target.id, context)
  })

  it('preserves dist-tag and normalized registry inputs while resolving the latest version', async () => {
    const dependencies = createDependencies()
    const adapter = createNpmProviderAdapter(dependencies)

    expect(
      await adapter.resolveLatestVersion?.({
        context,
        options: { distTag: 'next', registry: 'https://registry.npmjs.org/' },
        target,
      }),
    ).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'package', value: `npm:${target.id}@next=2.0.0` }],
        version: '2.0.0',
      },
    })
    expect(dependencies.resolveLatestVersion).toHaveBeenCalledWith(target.id, 'next', 'https://registry.npmjs.org')

    expect(await adapter.install?.({ context, options: { distTag: 'latest' }, target })).toEqual({
      kind: 'success',
      value: {
        evidence: [providerEvidence, { kind: 'command', value: `npm install -g ${target.id}@latest` }],
        target,
      },
    })
    expect(dependencies.install).toHaveBeenCalledWith(target.id, 'latest', undefined, context)
  })

  it('derives unsatisfied and indeterminate verification from fresh observations', async () => {
    const dependencies = createDependencies()
    const adapter = createNpmProviderAdapter(dependencies)
    const absentTarget = { ...target, id: `${target.id}-absent` }
    const unknownTarget = { ...target, id: `${target.id}-unknown` }

    expect(await adapter.verify?.({ context, target: absentTarget })).toEqual({
      kind: 'success',
      value: {
        evidence: [{ kind: 'package', value: `npm:${absentTarget.id}:absent` }],
        kind: 'unsatisfied',
        reason: `${absentTarget.id} is not installed through npm`,
      },
    })
    expect(await adapter.verify?.({ context, target: unknownTarget })).toEqual({
      evidence: [{ kind: 'provider', value: `npm:${unknownTarget.id}:presence-unknown` }],
      kind: 'indeterminate',
      reason: `npm could not determine whether ${unknownTarget.id} is installed`,
    })
    expect(dependencies.probePackagePresence).toHaveBeenCalledTimes(2)
  })

  it('returns the exact timeout without waiting for a never-settling dependency', async () => {
    const install = pendingMutation()
    const adapter = createNpmProviderAdapter(createDependencies({ install }))

    expect(
      await adapter.install?.({
        context: { ...context, timeoutMs: 3 },
        target,
      }),
    ).toEqual({ kind: 'timed-out', timeoutMs: 3 })
    expect(install).toHaveBeenCalledOnce()
  })

  it('does not invoke a dependency when the request signal is already aborted', async () => {
    const install = mutation()
    const adapter = createNpmProviderAdapter(createDependencies({ install }))
    const controller = new AbortController()
    controller.abort('user request')

    expect(await adapter.install?.({ context: { signal: controller.signal }, target })).toEqual({
      kind: 'cancelled',
      reason: 'user request',
    })
    expect(install).not.toHaveBeenCalled()
  })

  it('preserves a safe dependency rejection reason in the typed failure', async () => {
    const adapter = createNpmProviderAdapter(
      createDependencies({
        install: vi.fn(async () => {
          throw new Error('registry is offline')
        }),
      }),
    )

    expect(await adapter.install?.({ context, target })).toMatchObject({
      kind: 'failed',
      reason: `npm install failed for ${target.id}: registry is offline`,
      retryable: false,
    })
  })
})
