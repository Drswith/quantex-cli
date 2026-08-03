import type { ProviderAdapter, ProviderOperationContext, ProviderTarget } from '../../src/providers'
import type { SystemPackageAdapterDependencies } from '../../src/providers/adapters/system-package'
import { describe, expect, it, vi } from 'vitest'
import * as brewPm from '../../src/package-manager/brew'
import * as cargoPm from '../../src/package-manager/cargo'
import * as denoPm from '../../src/package-manager/deno'
import * as pipPm from '../../src/package-manager/pip'
import * as wingetPm from '../../src/package-manager/winget'
import { createBrewProviderAdapter } from '../../src/providers/adapters/brew'
import { createCargoProviderAdapter } from '../../src/providers/adapters/cargo'
import { createDenoProviderAdapter } from '../../src/providers/adapters/deno'
import { createPipProviderAdapter } from '../../src/providers/adapters/pip'
import { createWingetProviderAdapter } from '../../src/providers/adapters/winget'
import { describeProviderConformance } from './conformance'

const context: ProviderOperationContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
}

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

function createDependencies(
  overrides: Partial<SystemPackageAdapterDependencies> = {},
): SystemPackageAdapterDependencies {
  return {
    install: mutation(),
    isAvailable: vi.fn(async () => true),
    probePackagePresence: vi.fn(async target => {
      if (target.id.endsWith('-absent')) return 'absent'
      if (target.id.endsWith('-unknown')) return 'unknown'
      return 'present'
    }),
    uninstall: mutation(),
    update: mutation(),
    updateMany: mutation(),
    ...overrides,
  }
}

function addConformanceCases(
  name: 'brew' | 'winget',
  target: ProviderTarget,
  createAdapter: (dependencies: SystemPackageAdapterDependencies) => ProviderAdapter,
  installCommand: readonly string[],
  uninstallCommand: readonly string[],
): void {
  describeProviderConformance(`${name} provider`, () => {
    const dependencies = createDependencies({
      install: mutation(false),
      isAvailable: vi.fn(async () => false),
      update: pendingMutation(),
    })
    const adapter = createAdapter(dependencies)
    const presentEvidence = { kind: 'package', value: `${name}:${target.id}:present` } as const
    const commandEvidence = { kind: 'command', value: installCommand.join(' ') } as const

    return {
      adapter,
      cases: {
        absentEvidence: { kind: 'package', value: `${name}:${target.id}-absent:absent` },
        absentTarget: { ...target, id: `${target.id}-absent` },
        cancelled: (requestedAdapter, requestedContext, requestedTarget) =>
          requestedAdapter.update?.({ context: requestedContext, target: requestedTarget }),
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
        successfulMutation: {
          expected: {
            evidence: [
              { kind: 'provider', value: name },
              { kind: 'command', value: uninstallCommand.join(' ') },
            ],
            target,
          },
          invoke: (requestedAdapter, requestedContext, requestedTarget) =>
            requestedAdapter.uninstall?.({ context: requestedContext, target: requestedTarget }),
        },
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

addConformanceCases(
  'brew',
  brewTarget,
  createBrewProviderAdapter,
  ['brew', 'install', brewTarget.id],
  ['brew', 'uninstall', brewTarget.id],
)
addConformanceCases(
  'winget',
  wingetTarget,
  createWingetProviderAdapter,
  ['winget', 'install', '--id', wingetTarget.id, '-e'],
  ['winget', 'uninstall', '--id', wingetTarget.id, '-e'],
)

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
    expect(dependencies.updateMany).toHaveBeenCalledWith([brewTarget, cask], context)
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
    expect(dependencies.install).toHaveBeenCalledWith(wingetTarget, context)
    expect(dependencies.uninstall).toHaveBeenCalledWith(wingetTarget, context)
  })

  it('observes Homebrew presence through formula and cask probes instead of hardcoding unknown', async () => {
    const probe = vi.spyOn(brewPm, 'probePackagePresence').mockResolvedValue('present')
    const version = vi.spyOn(brewPm, 'getInstalledVersion').mockResolvedValue('1.2.3')
    const adapter = createBrewProviderAdapter()
    const cask = { id: 'example-cask', kind: 'cask' } as const

    await expect(adapter.observe({ context, target: brewTarget })).resolves.toMatchObject({
      kind: 'success',
      value: {
        kind: 'present',
        version: '1.2.3',
      },
    })
    await expect(adapter.observe({ context, target: cask })).resolves.toMatchObject({
      kind: 'success',
      value: { kind: 'present', version: '1.2.3' },
    })
    expect(probe).toHaveBeenNthCalledWith(1, brewTarget.id, 'package', context)
    expect(probe).toHaveBeenNthCalledWith(2, cask.id, 'cask', context)
    expect(version).toHaveBeenCalled()
    probe.mockRestore()
    version.mockRestore()
  })

  it('observes cargo, deno, pip, and winget presence through package probes instead of hardcoding unknown', async () => {
    const cargoProbe = vi.spyOn(cargoPm, 'probePackagePresence').mockResolvedValue('present')
    const cargoVersion = vi.spyOn(cargoPm, 'getInstalledVersion').mockResolvedValue('0.2.0')
    const denoProbe = vi.spyOn(denoPm, 'probePackagePresence').mockResolvedValue('present')
    const pipProbe = vi.spyOn(pipPm, 'probePackagePresence').mockResolvedValue('absent')
    const wingetProbe = vi.spyOn(wingetPm, 'probePackagePresence').mockResolvedValue('present')
    const wingetVersion = vi.spyOn(wingetPm, 'getInstalledVersion').mockResolvedValue('1.2.3')

    await expect(
      createCargoProviderAdapter().observe({ context, target: { id: 'vtcode', kind: 'package' } }),
    ).resolves.toMatchObject({
      kind: 'success',
      value: { kind: 'present', version: '0.2.0' },
    })
    await expect(
      createDenoProviderAdapter().observe({
        context,
        target: { binaryName: 'genie', id: 'jsr:@nicorio/genie', kind: 'tool' },
      }),
    ).resolves.toMatchObject({
      kind: 'success',
      value: { kind: 'present' },
    })
    await expect(
      createPipProviderAdapter().observe({ context, target: { id: 'mistral-vibe', kind: 'package' } }),
    ).resolves.toMatchObject({
      kind: 'success',
      value: { kind: 'absent' },
    })
    await expect(createWingetProviderAdapter().observe({ context, target: wingetTarget })).resolves.toMatchObject({
      kind: 'success',
      value: { kind: 'present', version: '1.2.3' },
    })

    expect(cargoProbe).toHaveBeenCalledWith('vtcode', context)
    expect(denoProbe).toHaveBeenCalledWith('genie', context)
    expect(pipProbe).toHaveBeenCalledWith('mistral-vibe', context)
    expect(wingetProbe).toHaveBeenCalledWith(wingetTarget.id, context)
    expect(cargoVersion).toHaveBeenCalled()
    expect(wingetVersion).toHaveBeenCalled()

    cargoProbe.mockRestore()
    cargoVersion.mockRestore()
    denoProbe.mockRestore()
    pipProbe.mockRestore()
    wingetProbe.mockRestore()
    wingetVersion.mockRestore()
  })
})
