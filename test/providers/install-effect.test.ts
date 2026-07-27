import type { ProviderExecutionEffect, ProviderOperationContext, ProviderTarget } from '../../src/providers'
import { describe, expect, it, vi } from 'vitest'
import { createInstallEffectProviderAdapter, getEffectCommand } from '../../src/providers/adapters/install-effect'
import { getPlatform } from '../../src/utils/detect'
import { describeProviderConformance } from './conformance'

const context: ProviderOperationContext = { signal: new AbortController().signal, timeoutMs: 5_000 }

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

function target(
  kind: 'binary' | 'script',
  effect: ProviderExecutionEffect,
  overrides: Partial<ProviderTarget> = {},
): ProviderTarget {
  return { binaryName: 'example', effect, id: 'example-agent', kind, ...overrides }
}

function addInstallEffectConformance(id: 'binary' | 'script'): void {
  const failedEffect =
    id === 'script'
      ? ({ command: 'exit 23', kind: 'shell-script' } as const)
      : ({ command: ['fixture-installer', '--fail'], kind: 'executable' } as const)
  const successfulEffect =
    id === 'script'
      ? ({ command: 'echo installed', kind: 'shell-script' } as const)
      : ({ command: ['fixture-installer', '--install'], kind: 'executable' } as const)
  const pendingEffect =
    id === 'script'
      ? ({ command: 'sleep 30', kind: 'shell-script' } as const)
      : ({ command: ['fixture-installer', '--wait'], kind: 'executable' } as const)
  const requestedTarget = target(id, failedEffect, {
    binaryName: `${id}-present`,
    id: `${id}-agent`,
  })
  const absentTarget = target(id, successfulEffect, {
    binaryName: `${id}-absent`,
    id: `${id}-agent-absent`,
  })
  const indeterminateTarget: ProviderTarget = {
    effect: successfulEffect,
    id: `${id}-agent-unknown`,
    kind: id,
  }
  const successfulTarget = target(id, successfulEffect, {
    binaryName: `${id}-present`,
    id: `${id}-agent-success`,
  })
  const pendingTarget = target(id, pendingEffect, {
    binaryName: `${id}-present`,
    id: `${id}-agent-pending`,
  })
  const failedCommand = getEffectCommand(failedEffect, getPlatform())
  const successfulCommand = getEffectCommand(successfulEffect, getPlatform())

  describeProviderConformance(`${id} provider`, () => {
    const execute = vi.fn(async (effect: ProviderExecutionEffect) => {
      if (effect === failedEffect) throw new Error('fixture execution failed')
      if (effect === pendingEffect) return new Promise<never>(() => {})
      return { kind: 'success', value: undefined } as const
    })
    const adapter = createInstallEffectProviderAdapter(id, {
      execute,
      isExecutablePresent: vi.fn(async binaryName => binaryName !== `${id}-absent`),
    })

    return {
      adapter,
      cases: {
        absentEvidence: { kind: 'executable', value: `${id}-absent` },
        absentTarget,
        cancelled: (subject, signalContext) => subject.install?.({ context: signalContext, target: pendingTarget }),
        failed: {
          expected: {
            command: failedCommand,
            evidence: [
              { kind: 'provider', value: id },
              { kind: 'command', value: failedCommand.join(' ') },
            ],
            reason: `${id} install failed for ${requestedTarget.id}: fixture execution failed`,
            remediation: 'Review the installer output and upstream installation instructions.',
            retryable: false,
          },
          invoke: (subject, signalContext, requested) =>
            subject.install?.({ context: signalContext, target: requested }),
        },
        indeterminate: {
          evidence: { kind: 'provider', value: `${id}:${indeterminateTarget.id}:presence-unknown` },
          reason: `${id} candidate does not declare an executable presence probe`,
          target: indeterminateTarget,
        },
        present: {
          evidence: { kind: 'executable', value: `${id}-present` },
          target: requestedTarget,
        },
        successfulMutation: {
          expected: {
            evidence: [
              { kind: 'provider', value: id },
              { kind: 'command', value: successfulCommand.join(' ') },
            ],
            target: successfulTarget,
          },
          invoke: (subject, signalContext) => subject.install?.({ context: signalContext, target: successfulTarget }),
        },
        timedOut: {
          invoke: (subject, signalContext) => subject.install?.({ context: signalContext, target: pendingTarget }),
          timeoutMs: 2,
        },
        unsupported: 'update',
        verificationEvidence: { kind: 'executable', value: `${id}-present` },
      },
      context,
      target: requestedTarget,
    }
  })
}

addInstallEffectConformance('script')
addInstallEffectConformance('binary')

describe('script and standalone-binary provider effects', () => {
  it('keeps shell-script effects explicit and platform invocation deterministic', () => {
    const effect = { command: 'curl -fsSL https://example.com/install.sh | sh', kind: 'shell-script' } as const

    expect(getEffectCommand(effect, 'linux')).toEqual(['sh', '-c', effect.command])
    expect(getEffectCommand(effect, 'macos')).toEqual(['sh', '-c', effect.command])
    expect(getEffectCommand(effect, 'windows')).toEqual(['powershell.exe', '-Command', effect.command])
  })

  it('executes argv effects directly without shell projection', async () => {
    const execute = mutation()
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
    expect(execute).toHaveBeenCalledWith(effect, context)
  })

  it('exposes install and fresh verification but no reversible mutation capability', () => {
    const adapter = createInstallEffectProviderAdapter('script', { execute: mutation() })

    expect(adapter.install).toBeTypeOf('function')
    expect(adapter.verify).toBeTypeOf('function')
    expect(adapter.update).toBeUndefined()
    expect(adapter.updateMany).toBeUndefined()
    expect(adapter.uninstall).toBeUndefined()
  })

  it('rejects an absent explicit effect with a typed non-retryable failure', async () => {
    const adapter = createInstallEffectProviderAdapter('script', { execute: mutation() })
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
      execute: mutation(),
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
      execute: mutation(false),
      isExecutablePresent: vi.fn(async () => false),
    })
    const pending = createInstallEffectProviderAdapter('script', {
      execute: pendingMutation(),
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
