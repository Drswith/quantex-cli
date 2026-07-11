import type { ProviderAdapter, ProviderOperationContext, ProviderTarget } from '../../src/providers'
import type { SystemPackageAdapterDependencies } from '../../src/providers/adapters/system-package'
import { describe, expect, it, vi } from 'vitest'
import { createBrewProviderAdapter } from '../../src/providers/adapters/brew'
import { createWingetProviderAdapter } from '../../src/providers/adapters/winget'
import { describeProviderConformance } from './conformance'

const context: ProviderOperationContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
}

function createDependencies(
  overrides: Partial<SystemPackageAdapterDependencies> = {},
): SystemPackageAdapterDependencies {
  return {
    install: vi.fn(async () => true),
    isAvailable: vi.fn(async () => true),
    probePackagePresence: vi.fn(async target => {
      if (target.id.endsWith('-absent')) return 'absent'
      if (target.id.endsWith('-unknown')) return 'unknown'
      return 'present'
    }),
    uninstall: vi.fn(async () => true),
    update: vi.fn(async () => true),
    updateMany: vi.fn(async () => true),
    ...overrides,
  }
}

function addConformanceCases(
  name: 'brew' | 'winget',
  target: ProviderTarget,
  createAdapter: (dependencies: SystemPackageAdapterDependencies) => ProviderAdapter,
  installCommand: readonly string[],
): void {
  describeProviderConformance(`${name} provider`, () => {
    const dependencies = createDependencies({
      install: vi.fn(async () => false),
      isAvailable: vi.fn(async () => false),
      update: vi.fn(() => new Promise<boolean>(() => {})),
    })
    const adapter = createAdapter(dependencies)
    const presentEvidence = { kind: 'package', value: `${name}:${target.id}:present` } as const
    const commandEvidence = { kind: 'command', value: installCommand.join(' ') } as const

    return {
      adapter,
      cases: {
        absentEvidence: { kind: 'package', value: `${name}:${target.id}-absent:absent` },
        absentTarget: { ...target, id: `${target.id}-absent` },
        cancelled: (requestedAdapter, requestedContext) => requestedAdapter.availability(requestedContext),
        failed: {
          expected: {
            command: installCommand,
            evidence: [{ kind: 'provider', value: name }, commandEvidence],
            reason: `${name} install failed for ${target.id}`,
            remediation: `Review ${name === 'brew' ? 'Homebrew' : 'winget'} output and retry the operation.`,
            retryable: false,
          },
          invoke: (requestedAdapter, requestedContext, requestedTarget) =>
            requestedAdapter.install?.({ context: requestedContext, target: requestedTarget }),
        },
        indeterminate: {
          evidence: { kind: 'provider', value: `${name}:${target.id}-unknown:presence-unknown` },
          reason: `${name} could not determine whether ${target.id}-unknown is installed`,
          target: { ...target, id: `${target.id}-unknown` },
        },
        present: { evidence: presentEvidence, target },
        timedOut: {
          invoke: (requestedAdapter, requestedContext, requestedTarget) =>
            requestedAdapter.update?.({ context: requestedContext, target: requestedTarget }),
          timeoutMs: 2,
        },
        unavailable: {
          invoke: requestedAdapter => requestedAdapter.availability(context),
          reason: `${name} executable is unavailable`,
        },
        unsupported: 'resolve-latest-version',
        verificationEvidence: presentEvidence,
      },
      context,
      target,
    }
  })
}

const brewTarget: ProviderTarget = { id: 'example/formula', kind: 'formula' }
const wingetTarget: ProviderTarget = { id: 'Example.Package', kind: 'id' }

addConformanceCases('brew', brewTarget, createBrewProviderAdapter, ['brew', 'install', brewTarget.id])
addConformanceCases('winget', wingetTarget, createWingetProviderAdapter, [
  'winget',
  'install',
  '--id',
  wingetTarget.id,
  '-e',
])

describe('system package provider semantics', () => {
  it('preserves Homebrew formula and cask commands and batch target kinds', async () => {
    const dependencies = createDependencies()
    const adapter = createBrewProviderAdapter(dependencies)
    const cask = { id: 'example-cask', kind: 'cask' } as const

    expect(await adapter.install?.({ context, target: brewTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'brew' },
          { kind: 'command', value: 'brew install example/formula' },
        ],
      },
    })
    expect(await adapter.update?.({ context, target: cask })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'brew' },
          { kind: 'command', value: 'brew upgrade --cask example-cask' },
        ],
      },
    })
    expect(await adapter.updateMany?.({ context, targets: [brewTarget, cask] })).toMatchObject({ kind: 'success' })
    expect(dependencies.updateMany).toHaveBeenCalledWith([brewTarget, cask])
  })

  it('preserves exact winget package IDs for every mutation', async () => {
    const dependencies = createDependencies()
    const adapter = createWingetProviderAdapter(dependencies)

    expect(await adapter.install?.({ context, target: wingetTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'winget' },
          { kind: 'command', value: 'winget install --id Example.Package -e' },
        ],
      },
    })
    expect(await adapter.uninstall?.({ context, target: wingetTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'winget' },
          { kind: 'command', value: 'winget uninstall --id Example.Package -e' },
        ],
      },
    })
    expect(dependencies.install).toHaveBeenCalledWith(wingetTarget)
    expect(dependencies.uninstall).toHaveBeenCalledWith(wingetTarget)
  })
})
