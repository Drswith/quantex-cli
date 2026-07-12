import type { ProviderExecutionEffect, ProviderOperationContext, ProviderTarget } from '../../src/providers'
import { describe, expect, it, vi } from 'vitest'
import { createInstallEffectProviderAdapter, getEffectCommand } from '../../src/providers/adapters/install-effect'

const context: ProviderOperationContext = { signal: new AbortController().signal, timeoutMs: 5_000 }

function target(kind: 'binary' | 'script', effect: ProviderExecutionEffect): ProviderTarget {
  return { binaryName: 'example', effect, id: 'example-agent', kind }
}

describe('script and standalone-binary provider effects', () => {
  it('keeps shell-script effects explicit and platform invocation deterministic', () => {
    const effect = { command: 'curl -fsSL https://example.com/install.sh | sh', kind: 'shell-script' } as const

    expect(getEffectCommand(effect, 'linux')).toEqual(['sh', '-c', effect.command])
    expect(getEffectCommand(effect, 'macos')).toEqual(['sh', '-c', effect.command])
    expect(getEffectCommand(effect, 'windows')).toEqual(['powershell.exe', '-Command', effect.command])
  })

  it('executes argv effects directly without shell projection', async () => {
    const execute = vi.fn(async () => true)
    const adapter = createInstallEffectProviderAdapter('binary', { execute })
    const effect = { command: ['installer', '--target', 'example'], kind: 'executable' } as const
    const requestedTarget = target('binary', effect)

    expect(await adapter.install?.({ context, target: requestedTarget })).toEqual({
      kind: 'success',
      value: {
        evidence: [
          { kind: 'provider', value: 'binary' },
          { kind: 'command', value: 'installer --target example' },
        ],
        target: requestedTarget,
      },
    })
    expect(execute).toHaveBeenCalledWith(effect)
  })

  it('exposes install but not update or uninstall capabilities', () => {
    const adapter = createInstallEffectProviderAdapter('script', { execute: vi.fn(async () => true) })

    expect(adapter.install).toBeTypeOf('function')
    expect(adapter.update).toBeUndefined()
    expect(adapter.updateMany).toBeUndefined()
    expect(adapter.uninstall).toBeUndefined()
  })

  it('rejects an absent explicit effect with a typed non-retryable failure', async () => {
    const adapter = createInstallEffectProviderAdapter('script', { execute: vi.fn(async () => true) })
    const requestedTarget: ProviderTarget = { id: 'example-agent', kind: 'script' }

    expect(await adapter.install?.({ context, target: requestedTarget })).toEqual({
      kind: 'failed',
      reason: 'script install target example-agent has no execution effect',
      remediation: 'Select a candidate with an explicit shell-script or executable effect.',
      retryable: false,
    })
  })

  it('observes the exact declared executable for install-effect targets', async () => {
    const isExecutablePresent = vi.fn(async (binaryName: string) => binaryName === 'example')
    const adapter = createInstallEffectProviderAdapter('script', {
      execute: vi.fn(async () => true),
      isExecutablePresent,
    })
    const requestedTarget = target('script', {
      command: 'curl -fsSL https://example.com/install.sh | sh',
      kind: 'shell-script',
    })

    expect(await adapter.observe({ context, target: requestedTarget })).toEqual({
      kind: 'success',
      value: {
        evidence: [{ kind: 'executable', value: 'example' }],
        kind: 'present',
        target: requestedTarget,
      },
    })
    expect(isExecutablePresent).toHaveBeenCalledWith('example')
  })

  it('keeps effect failure, cancellation, timeout, and indeterminate observation typed', async () => {
    const effect = { command: 'curl -fsSL https://example.com/install.sh | sh', kind: 'shell-script' } as const
    const requestedTarget = target('script', effect)
    const failed = createInstallEffectProviderAdapter('script', {
      execute: vi.fn(async () => false),
      isExecutablePresent: vi.fn(async () => false),
    })
    const pending = createInstallEffectProviderAdapter('script', {
      execute: vi.fn(() => new Promise<boolean>(() => {})),
    })
    const cancelledController = new AbortController()
    cancelledController.abort('cancelled fixture')

    expect(await failed.install?.({ context, target: requestedTarget })).toMatchObject({
      kind: 'failed',
      retryable: false,
    })
    expect(
      await pending.install?.({ context: { signal: cancelledController.signal }, target: requestedTarget }),
    ).toEqual({ kind: 'cancelled', reason: 'cancelled fixture' })
    expect(
      await pending.install?.({ context: { signal: context.signal, timeoutMs: 2 }, target: requestedTarget }),
    ).toEqual({ kind: 'timed-out', timeoutMs: 2 })
    expect(await failed.observe({ context, target: requestedTarget })).toEqual({
      kind: 'success',
      value: {
        evidence: [{ kind: 'executable', value: 'example' }],
        kind: 'absent',
        target: requestedTarget,
      },
    })

    const pendingObservation = createInstallEffectProviderAdapter('script', {
      isExecutablePresent: vi.fn(() => new Promise<boolean>(() => {})),
    })
    expect(
      await pendingObservation.observe({
        context: { signal: cancelledController.signal },
        target: requestedTarget,
      }),
    ).toEqual({ kind: 'cancelled', reason: 'cancelled fixture' })
    expect(
      await pendingObservation.observe({
        context: { signal: context.signal, timeoutMs: 2 },
        target: requestedTarget,
      }),
    ).toEqual({ kind: 'timed-out', timeoutMs: 2 })
  })
})
