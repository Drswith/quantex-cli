import type { ProviderOperationContext, ProviderOutcome } from '../providers/types'
import type {
  CoreInstallationExecutorPorts,
  CoreInstallationRecipe,
  CoreInstallationStateRecord,
  CoreMutationInterruptionOutcome,
  CoreMutationPhase,
  CoreMutationSideEffect,
} from './installation-executor-types'
import type { CoreInvocationCleanup, CoreInvocationContext } from './invocation'

export interface CoreMutationRecoveryResult {
  readonly reason?: string
  readonly remediation?: string
  readonly sideEffect: CoreMutationSideEffect
}

export class CoreMutationRecovery implements CoreInvocationCleanup {
  private active = true
  private cleanupPromise?: Promise<CoreMutationRecoveryResult>
  private commitStarted = false
  private record?: CoreInstallationStateRecord
  private recordWrite?: Promise<void>
  private unregister?: () => void

  constructor(
    private readonly recipe: CoreInstallationRecipe,
    private readonly context: CoreInvocationContext,
    private readonly ports: CoreInstallationExecutorPorts,
  ) {}

  register(): void {
    this.unregister = this.context.registerCleanup(this)
  }

  attachRecord(record: CoreInstallationStateRecord): void {
    this.record = record
  }

  async applyRecord(): Promise<void> {
    if (!this.record) throw new Error('Installation record was not prepared.')
    this.recordWrite = Promise.resolve().then(() => this.record!.apply())
    await this.recordWrite
  }

  async commitRecord(): Promise<void> {
    if (!this.record) throw new Error('Installation record was not prepared.')
    // commit() is the record contract's irreversible terminal transition. From
    // this line onward recovery must retain both state and provider resources.
    this.commitStarted = true
    await this.record.commit()
  }

  cleanup(): Promise<void> {
    return this.recover().then(() => undefined)
  }

  force(): Promise<void> {
    return this.cleanup()
  }

  recover(): Promise<CoreMutationRecoveryResult> {
    if (!this.cleanupPromise) this.cleanupPromise = this.runRecovery()
    return this.cleanupPromise
  }

  close(): void {
    this.active = false
    this.unregister?.()
  }

  private async runRecovery(): Promise<CoreMutationRecoveryResult> {
    if (!this.active) return { sideEffect: 'none' }
    if (this.commitStarted) {
      setMutationPhase(this.context, 'compensate', 'may-remain')
      return {
        reason: 'State commit crossed its irreversible boundary; resources were preserved.',
        remediation: preserveResourceRemediation(),
        sideEffect: 'may-remain',
      }
    }

    const rollbackReason = await this.rollbackState()
    if (rollbackReason) {
      // Keep the installed resource when state restoration is uncertain. Removing it
      // could turn a recoverable matching record into ghost provenance.
      setMutationPhase(this.context, 'compensate', 'may-remain')
      return {
        reason: rollbackReason,
        remediation: preserveResourceRemediation(),
        sideEffect: 'may-remain',
      }
    }
    if (this.recipe.ownership === 'pre-existing') {
      setMutationPhase(this.context, 'compensate', 'compensated')
      return { sideEffect: 'compensated' }
    }
    if (this.recipe.compensation === 'manual') {
      setMutationPhase(this.context, 'compensate', 'may-remain')
      return { sideEffect: 'may-remain' }
    }

    let compensated: Awaited<ReturnType<CoreInstallationExecutorPorts['compensate']>>
    try {
      compensated = await this.ports.compensate(this.recipe, recoveryContext(this.context.timeoutMs))
    } catch (error) {
      setMutationPhase(this.context, 'compensate', 'may-remain')
      return {
        reason: `Compensation failed: ${errorReason(error)}`,
        sideEffect: 'may-remain',
      }
    }
    if (compensated.kind === 'success') {
      setMutationPhase(this.context, 'compensate', 'compensated')
      return { sideEffect: 'compensated' }
    }

    setMutationPhase(this.context, 'compensate', 'may-remain')
    return {
      reason: providerReason(compensated),
      sideEffect: 'may-remain',
    }
  }

  private async rollbackState(): Promise<string | undefined> {
    if (!this.record) return undefined
    try {
      await this.recordWrite?.catch(() => undefined)
      await this.record.rollback()
      return undefined
    } catch (error) {
      return `State rollback failed: ${errorReason(error)}`
    }
  }
}

export class CoreMutationInterruption extends Error {
  readonly details: Readonly<{ phase: CoreMutationPhase; sideEffect: CoreMutationSideEffect }>
  readonly kind: 'cancelled' | 'timed-out'
  readonly reason?: string
  readonly timeoutMs?: number

  constructor(outcome: CoreMutationInterruptionOutcome, phase: CoreMutationPhase, sideEffect: CoreMutationSideEffect) {
    super(outcome.kind === 'timed-out' ? 'Core mutation timed out.' : 'Core mutation was cancelled.')
    this.name = 'CoreMutationInterruption'
    this.kind = outcome.kind
    this.details = { phase, sideEffect }
    if (outcome.kind === 'timed-out') this.timeoutMs = outcome.timeoutMs
    else this.reason = outcome.reason
  }
}

export function mutationInterruption(
  outcome: CoreMutationInterruptionOutcome,
  phase: CoreMutationPhase,
  sideEffect: CoreMutationSideEffect,
): CoreMutationInterruption {
  return new CoreMutationInterruption(outcome, phase, sideEffect)
}

export function signalInterruption(
  signal: AbortSignal,
  phase: CoreMutationPhase,
  sideEffect: CoreMutationSideEffect,
): CoreMutationInterruption {
  return mutationInterruption(
    { kind: 'cancelled', ...(signal.reason === undefined ? {} : { reason: errorReason(signal.reason) }) },
    phase,
    sideEffect,
  )
}

export function setMutationPhase(
  context: CoreInvocationContext,
  phase: CoreMutationPhase,
  sideEffect: CoreMutationSideEffect,
): void {
  context.setInterruptionDetails({ phase, sideEffect })
}

export function createMutationSettlementBarrier(context: CoreInvocationContext): { release(): void } {
  let resolve!: () => void
  const settled = new Promise<void>(done => {
    resolve = done
  })
  const unregister = context.registerCleanup({ cleanup: () => settled, force: () => settled })
  return {
    release(): void {
      unregister()
      resolve()
    },
  }
}

function recoveryContext(timeoutMs: number | undefined): ProviderOperationContext {
  return {
    signal: new AbortController().signal,
    timeoutMs: timeoutMs === undefined ? 5_000 : Math.max(10, Math.min(timeoutMs, 5_000)),
  }
}

function providerReason(outcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>): string {
  if ('reason' in outcome && outcome.reason) return outcome.reason
  return outcome.kind === 'unsupported'
    ? `Provider does not support ${outcome.operation}.`
    : `Provider ${outcome.kind} during compensation.`
}

function errorReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'Core lifecycle operation failed.'
}

function preserveResourceRemediation(): string {
  return 'Keep the installed resource in place. Inspect Quantex state and lock files, then run inspect or ensure again.'
}
