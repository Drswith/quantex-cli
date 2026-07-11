import type {
  ProviderAdapter,
  ProviderMutationEvidence,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers'
import { describeProviderConformance } from './conformance'

const target: ProviderTarget = {
  id: 'fixture-agent',
  kind: 'package',
}

const presentEvidence = { kind: 'provider', value: 'fixture@1.2.3' } as const
const verificationEvidence = { kind: 'package', value: 'fixture-agent@1.2.3' } as const
const failureEvidence = { kind: 'command', value: 'fixture install fixture-agent' } as const
const indeterminateEvidence = { kind: 'provider', value: 'fixture response was malformed' } as const

function success<T>(value: T): ProviderOutcome<T> {
  return { kind: 'success', value }
}

function mutationEvidence(): ProviderMutationEvidence {
  return {
    evidence: [{ kind: 'command', value: 'fixture update fixture-agent' }],
    target,
  }
}

function createFixtureAdapter(): ProviderAdapter {
  return {
    availability: async context =>
      context.signal.aborted
        ? { kind: 'cancelled', reason: String(context.signal.reason ?? 'cancelled') }
        : success({ executable: 'fixture' }),
    id: 'npm',
    install: async ({ target: requestedTarget }) => ({
      command: ['fixture', 'install', requestedTarget.id],
      evidence: [{ kind: 'command', value: `fixture install ${requestedTarget.id}` }],
      exitCode: 23,
      kind: 'failed',
      reason: 'fixture install failed',
      remediation: 'repair the fixture registry',
      retryable: true,
    }),
    observe: async ({ target: requestedTarget }) =>
      requestedTarget.id.endsWith('-absent')
        ? success({ kind: 'absent', target: requestedTarget })
        : requestedTarget.id.endsWith('-indeterminate')
          ? {
              evidence: [indeterminateEvidence],
              kind: 'indeterminate',
              reason: 'fixture response was ambiguous',
            }
          : success({
              evidence: [presentEvidence],
              kind: 'present',
              target: requestedTarget,
              version: '1.2.3',
            }),
    uninstall: async ({ context }) =>
      context.timeoutMs === 1
        ? { kind: 'timed-out', timeoutMs: context.timeoutMs }
        : ({ kind: 'unavailable', reason: 'fixture executable is unavailable' } as const),
    update: async () => success(mutationEvidence()),
    verify: async () =>
      success({
        evidence: [verificationEvidence],
        kind: 'satisfied',
      }),
  }
}

function operationContext(options: { timeoutMs?: number } = {}): ProviderOperationContext {
  return {
    signal: new AbortController().signal,
    timeoutMs: options.timeoutMs,
  }
}

describeProviderConformance('fixture provider', () => ({
  adapter: createFixtureAdapter(),
  cases: {
    absentTarget: { ...target, id: 'fixture-agent-absent' },
    cancelled: (adapter, context) => adapter.availability(context),
    failed: {
      expected: {
        command: ['fixture', 'install', target.id],
        evidence: [failureEvidence],
        exitCode: 23,
        reason: 'fixture install failed',
        remediation: 'repair the fixture registry',
        retryable: true,
      },
      invoke: (adapter, context, requestedTarget) => adapter.install?.({ context, target: requestedTarget }),
    },
    indeterminate: {
      evidence: indeterminateEvidence,
      reason: 'fixture response was ambiguous',
      target: { ...target, id: 'fixture-agent-indeterminate' },
    },
    present: {
      evidence: presentEvidence,
      target,
      version: '1.2.3',
    },
    timedOut: {
      invoke: (adapter, context, requestedTarget) => adapter.uninstall?.({ context, target: requestedTarget }),
      timeoutMs: 1,
    },
    unavailable: {
      invoke: (adapter, context, requestedTarget) => adapter.uninstall?.({ context, target: requestedTarget }),
      reason: 'fixture executable is unavailable',
    },
    unsupported: 'resolve-latest-version',
    verificationEvidence,
  },
  context: operationContext(),
  target,
}))
