import type { ProviderAdapter, ProviderOperationContext, ProviderTarget } from '../../src/providers'
import type { SystemPackageAdapterDependencies } from '../../src/providers/adapters/system-package'
import { describe, expect, it, vi } from 'vitest'
import { createCargoProviderAdapter } from '../../src/providers/adapters/cargo'
import { createDenoProviderAdapter } from '../../src/providers/adapters/deno'
import { describeProviderConformance } from './conformance'

const context: ProviderOperationContext = { signal: new AbortController().signal, timeoutMs: 5_000 }

function dependencies(overrides: Partial<SystemPackageAdapterDependencies> = {}): SystemPackageAdapterDependencies {
  return {
    install: vi.fn(async () => true),
    isAvailable: vi.fn(async () => true),
    probePackagePresence: vi.fn(async target =>
      target.id.endsWith('-absent') ? 'absent' : target.id.endsWith('-unknown') ? 'unknown' : 'present',
    ),
    uninstall: vi.fn(async () => true),
    update: vi.fn(async () => true),
    updateMany: vi.fn(async () => true),
    ...overrides,
  }
}

function conformance(
  id: 'cargo' | 'deno',
  displayName: string,
  target: ProviderTarget,
  createAdapter: (dependencies: SystemPackageAdapterDependencies) => ProviderAdapter,
  installCommand: readonly string[],
): void {
  describeProviderConformance(`${id} provider`, () => {
    const adapter = createAdapter(
      dependencies({
        install: vi.fn(async () => false),
        isAvailable: vi.fn(async () => false),
        update: vi.fn(() => new Promise<boolean>(() => {})),
      }),
    )
    const presentEvidence = { kind: 'package', value: `${id}:${target.id}:present` } as const
    return {
      adapter,
      cases: {
        absentEvidence: { kind: 'package', value: `${id}:${target.id}-absent:absent` },
        absentTarget: { ...target, id: `${target.id}-absent` },
        cancelled: (subject, signalContext) => subject.availability(signalContext),
        failed: {
          expected: {
            command: installCommand,
            evidence: [
              { kind: 'provider', value: id },
              { kind: 'command', value: installCommand.join(' ') },
            ],
            reason: `${id} install failed for ${target.id}`,
            remediation: `Review ${displayName} output and retry the operation.`,
            retryable: false,
          },
          invoke: (subject, signalContext, requestedTarget) =>
            subject.install?.({ context: signalContext, target: requestedTarget }),
        },
        indeterminate: {
          evidence: { kind: 'provider', value: `${id}:${target.id}-unknown:presence-unknown` },
          reason: `${id} could not determine whether ${target.id}-unknown is installed`,
          target: { ...target, id: `${target.id}-unknown` },
        },
        present: { evidence: presentEvidence, target },
        timedOut: {
          invoke: (subject, signalContext, requestedTarget) =>
            subject.update?.({ context: signalContext, target: requestedTarget }),
          timeoutMs: 2,
        },
        unavailable: {
          invoke: subject => subject.availability(context),
          reason: `${id} executable is unavailable`,
        },
        unsupported: 'resolve-latest-version',
        verificationEvidence: presentEvidence,
      },
      context,
      target,
    }
  })
}

const cargoTarget: ProviderTarget = { arguments: ['--locked'], id: 'some-crate', kind: 'package' }
const denoTarget: ProviderTarget = {
  arguments: ['--allow-net', '--name', 'tool-bin'],
  binaryName: 'tool-bin',
  id: 'jsr:@scope/tool',
  kind: 'tool',
}

conformance('cargo', 'Cargo', cargoTarget, createCargoProviderAdapter, ['cargo', 'install', 'some-crate', '--locked'])
conformance('deno', 'Deno', denoTarget, createDenoProviderAdapter, [
  'deno',
  'install',
  '--global',
  '--allow-net',
  '--name',
  'tool-bin',
  'jsr:@scope/tool',
])

describe('Cargo and Deno provider semantics', () => {
  it('preserves Cargo install arguments and forced update ordering', async () => {
    const deps = dependencies()
    const adapter = createCargoProviderAdapter(deps)

    expect(await adapter.install?.({ context, target: cargoTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'cargo' },
          { kind: 'command', value: 'cargo install some-crate --locked' },
        ],
      },
    })
    expect(await adapter.update?.({ context, target: cargoTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'cargo' },
          { kind: 'command', value: 'cargo install some-crate --force --locked' },
        ],
      },
    })
    expect(deps.install).toHaveBeenCalledWith(cargoTarget)
    expect(deps.update).toHaveBeenCalledWith(cargoTarget)
  })

  it('preserves Deno argument ordering and executable-name uninstall', async () => {
    const deps = dependencies()
    const adapter = createDenoProviderAdapter(deps)

    expect(await adapter.update?.({ context, target: denoTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'deno' },
          { kind: 'command', value: 'deno install --global --force --allow-net --name tool-bin jsr:@scope/tool' },
        ],
      },
    })
    expect(await adapter.uninstall?.({ context, target: denoTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'deno' },
          { kind: 'command', value: 'deno uninstall --global tool-bin' },
        ],
      },
    })
    expect(deps.uninstall).toHaveBeenCalledWith(denoTarget)
  })
})
