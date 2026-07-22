import type { ProviderAdapter, ProviderOperationContext, ProviderTarget } from '../../src/providers'
import type { SystemPackageAdapterDependencies } from '../../src/providers/adapters/system-package'
import { describe, expect, it, vi } from 'vitest'
import { createMiseProviderAdapter } from '../../src/providers/adapters/mise'
import { createPipProviderAdapter } from '../../src/providers/adapters/pip'
import { createUvProviderAdapter } from '../../src/providers/adapters/uv'
import { describeProviderConformance } from './conformance'

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

const context: ProviderOperationContext = { signal: new AbortController().signal, timeoutMs: 5_000 }

function dependencies(overrides: Partial<SystemPackageAdapterDependencies> = {}): SystemPackageAdapterDependencies {
  return {
    getInstalledVersion: vi.fn(async () => '1.2.3'),
    install: mutation(),
    isAvailable: vi.fn(async () => true),
    probePackagePresence: vi.fn(async target =>
      target.id.endsWith('-absent') ? 'absent' : target.id.endsWith('-unknown') ? 'unknown' : 'present',
    ),
    uninstall: mutation(),
    update: mutation(),
    updateMany: mutation(),
    ...overrides,
  }
}

function conformance(
  id: 'mise' | 'pip' | 'uv',
  displayName: string,
  executable: string,
  target: ProviderTarget,
  createAdapter: (dependencies: SystemPackageAdapterDependencies) => ProviderAdapter,
  installCommand: readonly string[],
  uninstallCommand: readonly string[],
): void {
  describeProviderConformance(`${id} provider`, () => {
    const adapter = createAdapter(
      dependencies({
        install: mutation(false),
        isAvailable: vi.fn(async () => false),
        update: pendingMutation(),
      }),
    )
    const presentEvidence = { kind: 'package', value: `${id}:${target.id}:present` } as const
    return {
      adapter,
      cases: {
        absentEvidence: { kind: 'package', value: `${id}:${target.id}-absent:absent` },
        absentTarget: { ...target, id: `${target.id}-absent` },
        cancelled: (subject, signalContext, requestedTarget) =>
          subject.update?.({ context: signalContext, target: requestedTarget }),
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
        present: { evidence: presentEvidence, target, version: '1.2.3' },
        successfulMutation: {
          expected: {
            evidence: [
              { kind: 'provider', value: id },
              { kind: 'command', value: uninstallCommand.join(' ') },
            ],
            target,
          },
          invoke: (subject, signalContext, requestedTarget) =>
            subject.uninstall?.({ context: signalContext, target: requestedTarget }),
        },
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

const pipTarget: ProviderTarget = { id: 'example-pkg', kind: 'package' }
const uvTarget: ProviderTarget = { arguments: ['--python', '3.12'], id: 'example-tool', kind: 'tool' }
const miseTarget: ProviderTarget = { id: 'npm:@openai/codex', kind: 'tool' }

conformance(
  'pip',
  'pip',
  'pip',
  pipTarget,
  createPipProviderAdapter,
  ['pip', 'install', 'example-pkg'],
  ['pip', 'uninstall', '-y', 'example-pkg'],
)
conformance(
  'uv',
  'uv',
  'uv',
  uvTarget,
  createUvProviderAdapter,
  ['uv', 'tool', 'install', 'example-tool', '--python', '3.12'],
  ['uv', 'tool', 'uninstall', 'example-tool'],
)
conformance(
  'mise',
  'mise',
  'mise',
  miseTarget,
  createMiseProviderAdapter,
  ['mise', 'use', '--global', 'npm:@openai/codex'],
  ['mise', 'unuse', '--global', 'npm:@openai/codex'],
)

describe('pip, uv, and mise provider semantics', () => {
  it('preserves uv tool arguments for install and update', async () => {
    const deps = dependencies()
    const adapter = createUvProviderAdapter(deps)

    await adapter.install?.({ context, target: uvTarget })
    expect(await adapter.update?.({ context, target: uvTarget })).toMatchObject({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'uv' },
          { kind: 'command', value: 'uv tool upgrade example-tool --python 3.12' },
        ],
      },
    })
    expect(deps.install).toHaveBeenCalledWith(uvTarget, context)
    expect(deps.update).toHaveBeenCalledWith(uvTarget, context)
  })

  it('projects provider-specific installed versions into typed observations', async () => {
    const uv = createUvProviderAdapter(dependencies({ getInstalledVersion: vi.fn(async () => '2.0.0') }))
    const mise = createMiseProviderAdapter(dependencies({ getInstalledVersion: vi.fn(async () => '0.42.0') }))

    expect(await uv.observe({ context, target: uvTarget })).toMatchObject({
      kind: 'success',
      value: { kind: 'present', version: '2.0.0' },
    })
    expect(await mise.observe({ context, target: miseTarget })).toMatchObject({
      kind: 'success',
      value: { kind: 'present', version: '0.42.0' },
    })
  })
})
