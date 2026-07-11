import type {
  ProviderAdapter,
  ProviderEvidence,
  ProviderOptionalOperation,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
} from '../../src/providers'
import { describe, expect, it } from 'vitest'
import { createProviderRegistry, invokeProviderOperation } from '../../src/providers'

type AdapterOperation = (
  adapter: ProviderAdapter,
  context: ProviderOperationContext,
  target: ProviderTarget,
) => Promise<ProviderOutcome<unknown> | undefined> | ProviderOutcome<unknown> | undefined

interface ExpectedFailure {
  readonly command: readonly string[]
  readonly evidence: readonly ProviderEvidence[]
  readonly exitCode?: number | null
  readonly reason: string
  readonly remediation: string
  readonly retryable: boolean
}

export interface ProviderConformanceSubject {
  readonly adapter: ProviderAdapter
  readonly cases: {
    readonly absentTarget: ProviderTarget
    readonly absentEvidence?: ProviderEvidence
    readonly cancelled: AdapterOperation
    readonly failed: {
      readonly expected: ExpectedFailure
      readonly invoke: AdapterOperation
    }
    readonly indeterminate: {
      readonly evidence: ProviderEvidence
      readonly reason: string
      readonly target: ProviderTarget
    }
    readonly present: {
      readonly evidence: ProviderEvidence
      readonly target: ProviderTarget
      readonly version?: string
    }
    readonly timedOut: {
      readonly invoke: AdapterOperation
      readonly timeoutMs: number
    }
    readonly unavailable: {
      readonly invoke: AdapterOperation
      readonly reason: string
    }
    readonly unsupported?: Exclude<ProviderOptionalOperation, 'update-many'>
    readonly verificationEvidence: ProviderEvidence
  }
  readonly context: ProviderOperationContext
  readonly target: ProviderTarget
}

export function describeProviderConformance(name: string, createSubject: () => ProviderConformanceSubject): void {
  describe(`${name} conformance`, () => {
    it('derives a typed unsupported outcome from an absent adapter operation', async () => {
      const subject = createSubject()
      if (!subject.cases.unsupported) return

      const capabilities = createProviderRegistry([subject.adapter]).getCapabilities(subject.adapter.id)
      const outcome = await invokeProviderOperation(subject.adapter, subject.cases.unsupported, {
        context: subject.context,
        target: subject.target,
      })

      expect(capabilities).not.toContain(subject.cases.unsupported)
      expect(outcome).toEqual({
        kind: 'unsupported',
        operation: subject.cases.unsupported,
        reason: `${subject.adapter.id} does not implement ${subject.cases.unsupported}`,
      })
    })

    it('preserves exact typed provider failure diagnostics', async () => {
      const subject = createSubject()
      const outcome = await subject.cases.failed.invoke(subject.adapter, subject.context, subject.target)

      expect(outcome).toEqual({ kind: 'failed', ...subject.cases.failed.expected })
    })

    it('uses the supplied aborted signal to distinguish cancellation', async () => {
      const subject = createSubject()
      const liveContext = createOperationContext()
      const liveOutcome = await subject.cases.cancelled(subject.adapter, liveContext, subject.target)
      expect(liveContext.signal.aborted).toBe(false)
      expect(liveOutcome?.kind).not.toBe('cancelled')

      const cancelledContext = createOperationContext({ aborted: true })
      expect(cancelledContext.signal.aborted).toBe(true)
      const cancelledOutcome = await subject.cases.cancelled(subject.adapter, cancelledContext, subject.target)
      expect(cancelledOutcome).toMatchObject({ kind: 'cancelled' })
    })

    it('returns the effective timeout supplied by the harness', async () => {
      const subject = createSubject()
      const expectedTimeoutMs = subject.cases.timedOut.timeoutMs
      const outcome = await subject.cases.timedOut.invoke(
        subject.adapter,
        createOperationContext({ timeoutMs: expectedTimeoutMs }),
        subject.target,
      )

      expect(outcome).toEqual({ kind: 'timed-out', timeoutMs: expectedTimeoutMs })

      const controlTimeoutMs = expectedTimeoutMs + 1
      const controlOutcome = await subject.cases.timedOut.invoke(
        subject.adapter,
        createOperationContext({ timeoutMs: controlTimeoutMs }),
        subject.target,
      )
      if (controlOutcome?.kind === 'timed-out') {
        expect(controlOutcome.timeoutMs).toBe(controlTimeoutMs)
      }
    })

    it('distinguishes provider unavailability from command failure', async () => {
      const subject = createSubject()
      const outcome = await subject.cases.unavailable.invoke(subject.adapter, subject.context, subject.target)

      expect(outcome).toEqual({ kind: 'unavailable', reason: subject.cases.unavailable.reason })
    })

    it('observes present and absent targets with exact provider evidence', async () => {
      const subject = createSubject()
      const present = await subject.adapter.observe({ context: subject.context, target: subject.cases.present.target })
      const absent = await subject.adapter.observe({ context: subject.context, target: subject.cases.absentTarget })

      expect(present?.kind).toBe('success')
      if (present.kind !== 'success') throw new Error('Expected a successful present observation.')
      expect(present.value.kind).toBe('present')
      if (present.value.kind !== 'present') throw new Error('Expected a present provider observation.')
      expect(present.value.version).toBe(subject.cases.present.version)
      expect(present.value.evidence).toContainEqual(subject.cases.present.evidence)

      expect(absent).toEqual({
        kind: 'success',
        value: {
          ...(subject.cases.absentEvidence ? { evidence: [subject.cases.absentEvidence] } : {}),
          kind: 'absent',
          target: subject.cases.absentTarget,
        },
      })
    })

    it('keeps indeterminate observation evidence distinct from absence', async () => {
      const subject = createSubject()
      const outcome = await subject.adapter.observe({
        context: subject.context,
        target: subject.cases.indeterminate.target,
      })

      expect(outcome).toEqual({
        evidence: [subject.cases.indeterminate.evidence],
        kind: 'indeterminate',
        reason: subject.cases.indeterminate.reason,
      })
    })

    it('returns exact provider-specific evidence for successful verification', async () => {
      const subject = createSubject()
      expect(subject.adapter.verify).toBeTypeOf('function')
      if (!subject.adapter.verify) throw new Error('Expected a verification operation.')

      const outcome = await subject.adapter.verify({ context: subject.context, target: subject.target })
      expect(outcome).toEqual({
        kind: 'success',
        value: {
          evidence: [subject.cases.verificationEvidence],
          kind: 'satisfied',
        },
      })
    })
  })
}

function createOperationContext(options: { aborted?: boolean; timeoutMs?: number } = {}): ProviderOperationContext {
  const controller = new AbortController()
  if (options.aborted) controller.abort('provider conformance cancellation')

  return {
    signal: controller.signal,
    timeoutMs: options.timeoutMs,
  }
}
