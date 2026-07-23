import type { LifecycleProviderBinding } from '../lifecycle/provider-binding'
import type { ProviderOperationContext, ProviderOutcome } from '../providers/types'
import type { CoreInstallationDirective } from './installation-decision'
import type {
  CoreInstallationExecutionOutcome,
  CoreInstallationExecutorPorts,
  CoreInstallationRecipe,
  CoreInstallationRecipeResolution,
  CoreMutationFailure,
  CoreMutationInterruptionOutcome,
  CoreMutationPhase,
  CoreMutationSideEffect,
} from './installation-executor-types'
import type { CoreInvocationContext } from './invocation'
import type { CoreAgentObservation } from './production-observation'
import {
  providerBindingsEqual,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../lifecycle/provider-binding'
import { decideCoreInstallation } from './installation-decision'
import {
  CoreMutationInterruption,
  CoreMutationRecovery,
  createMutationSettlementBarrier,
  mutationInterruption,
  setMutationPhase,
  signalInterruption,
} from './mutation-recovery'

export type {
  CoreInstallationExecutionOutcome,
  CoreInstallationExecutionValue,
  CoreInstallationExecutorPorts,
  CoreInstallationRecipe,
  CoreInstallationRecipeResolution,
  CoreInstallationStateRecord,
  CoreMutationFailure,
  CoreMutationPhase,
  CoreMutationSideEffect,
} from './installation-executor-types'
export { CoreMutationInterruption } from './mutation-recovery'

interface InstallationRequest {
  readonly mode: 'apply' | 'preview'
  readonly name: string
  readonly operation: 'ensure' | 'install'
}

type ReadyDecision = Extract<CoreInstallationDirective, { readonly kind: 'ready' }>
type MutatingDecision = Extract<ReadyDecision, { readonly wouldChange: true }>

export async function executeCoreInstallation(
  input: InstallationRequest,
  context: CoreInvocationContext,
  ports: CoreInstallationExecutorPorts,
): Promise<CoreInstallationExecutionOutcome> {
  const settlement = createMutationSettlementBarrier(context)
  setMutationPhase(context, 'decide', 'none')
  let completed: CoreInstallationExecutionOutcome | undefined
  try {
    if (input.mode === 'preview') return await preview(input, context, ports)
    return await ports.withMutationLock(input.name, context, async () => {
      completed = await apply(input, context, ports)
      return completed
    })
  } catch (error) {
    if (error instanceof CoreMutationInterruption) throw error
    const sideEffect = completedSideEffect(completed)
    if (context.signal.aborted)
      throw signalInterruption(context.signal, sideEffect === 'none' ? 'decide' : 'record', sideEffect)
    return failure(
      'execution-failed',
      sideEffect === 'none' ? 'decide' : 'record',
      sideEffect,
      `Lifecycle mutation lock failed: ${errorReason(error)}`,
      false,
    )
  } finally {
    settlement.release()
  }
}

async function preview(
  input: InstallationRequest,
  context: CoreInvocationContext,
  ports: CoreInstallationExecutorPorts,
): Promise<CoreInstallationExecutionOutcome> {
  const observed = await observeDecision(input.name, context, ports)
  if (observed.kind !== 'ready') return observed.outcome
  const { before, directive } = observed

  if (!isMutating(directive)) return successPreview(before, directive)
  const recipe = await resolveRecipe(input, before, directive, context, ports)
  if (recipe.kind !== 'ready') return recipe.outcome
  return {
    kind: 'success',
    value: {
      before,
      binding: recipe.value.binding,
      decision: directive.decision,
      kind: 'preview',
      wouldChange: true,
    },
  }
}

async function apply(
  input: InstallationRequest,
  context: CoreInvocationContext,
  ports: CoreInstallationExecutorPorts,
): Promise<CoreInstallationExecutionOutcome> {
  const observed = await observeDecision(input.name, context, ports)
  if (observed.kind !== 'ready') return observed.outcome
  const { before, directive } = observed

  if (!isMutating(directive)) return await confirmNoChange(input.name, before, directive, context, ports)
  const resolved = await resolveRecipe(input, before, directive, context, ports)
  if (resolved.kind !== 'ready') return resolved.outcome

  const recipe = resolved.value
  setMutationPhase(context, 'execute', 'may-remain')
  let installed: Awaited<ReturnType<CoreInstallationExecutorPorts['install']>>
  try {
    installed = await ports.install(recipe, operationContext(context))
  } catch (error) {
    if (context.signal.aborted) throw signalInterruption(context.signal, 'execute', 'may-remain')
    return failure('execution-failed', 'execute', 'may-remain', errorReason(error), false, manualRemediation())
  }
  if (isInterruption(installed)) throw mutationInterruption(installed, 'execute', 'may-remain')
  if (installed.kind !== 'success') return providerFailure('execution-failed', 'execute', installed)

  // Successful execution plus the resolver's conclusive pre-absence proof is the ownership boundary.
  const recovery = new CoreMutationRecovery(recipe, context, ports)
  recovery.register()
  if (context.signal.aborted) return await interruptOwned(context.signal, 'execute', recovery)

  setMutationPhase(context, 'verify', 'may-remain')
  let providerVerification: Awaited<ReturnType<CoreInstallationExecutorPorts['verify']>>
  try {
    providerVerification = await ports.verify(recipe, operationContext(context))
  } catch (error) {
    return await recoverFailure(recovery, 'verification-failed', 'verify', errorReason(error), false)
  }
  if (isInterruption(providerVerification)) return await interruptProvider(providerVerification, 'verify', recovery)
  if (providerVerification.kind !== 'success') {
    return await recoverFailure(
      recovery,
      'verification-failed',
      'verify',
      providerReason(providerVerification),
      providerRetryable(providerVerification),
    )
  }
  if (providerVerification.value.kind === 'unsatisfied') {
    return await recoverFailure(recovery, 'verification-failed', 'verify', providerVerification.value.reason, false)
  }

  let verified: CoreAgentObservation | undefined
  try {
    verified = await ports.observe(input.name, context)
  } catch (error) {
    return await recoverFailure(recovery, 'verification-failed', 'verify', errorReason(error), false)
  }
  if (context.signal.aborted) return await interruptOwned(context.signal, 'verify', recovery)
  const verifiedInterruption = observationInterruption(verified)
  if (verifiedInterruption) return await interruptProvider(verifiedInterruption, 'verify', recovery)
  if (!verified || !matchesLiveRecipe(verified, recipe)) {
    return await recoverFailure(
      recovery,
      'verification-failed',
      'verify',
      'Fresh post-mutation observation did not confirm the selected provider source.',
      false,
    )
  }

  try {
    setMutationPhase(context, 'record', 'may-remain')
    recovery.attachRecord(await ports.prepareRecord({ before, context, recipe, verified }))
    if (context.signal.aborted) return await interruptOwned(context.signal, 'record', recovery)
    await recovery.applyRecord()
  } catch (error) {
    return await recoverFailure(recovery, 'recording-failed', 'record', errorReason(error), false)
  }
  if (context.signal.aborted) return await interruptOwned(context.signal, 'record', recovery)

  setMutationPhase(context, 'verify', 'may-remain')
  let after: CoreAgentObservation | undefined
  try {
    after = await ports.observe(input.name, context)
  } catch (error) {
    return await recoverFailure(recovery, 'verification-failed', 'verify', errorReason(error), false)
  }
  if (context.signal.aborted) return await interruptOwned(context.signal, 'verify', recovery)
  const afterInterruption = observationInterruption(after)
  if (afterInterruption) return await interruptProvider(afterInterruption, 'verify', recovery)
  if (!after || !matchesRecordedRecipe(after, recipe)) {
    return await recoverFailure(
      recovery,
      'verification-failed',
      'verify',
      'Fresh post-mutation observation did not confirm the recorded provider source.',
      false,
    )
  }

  try {
    setMutationPhase(context, 'record', 'may-remain')
    if (context.signal.aborted) return await interruptOwned(context.signal, 'record', recovery)
    await recovery.commitRecord()
  } catch (error) {
    return await recoverFailure(recovery, 'recording-failed', 'record', errorReason(error), false)
  }
  if (context.signal.aborted) return await interruptOwned(context.signal, 'record', recovery)

  recovery.close()
  return {
    kind: 'success',
    value: { after, before, binding: recipe.binding, changed: true, decision: directive.decision, kind: 'apply' },
  }
}

async function observeDecision(
  name: string,
  context: CoreInvocationContext,
  ports: CoreInstallationExecutorPorts,
): Promise<
  | { readonly before: CoreAgentObservation; readonly directive: ReadyDecision; readonly kind: 'ready' }
  | { readonly kind: 'terminal'; readonly outcome: CoreInstallationExecutionOutcome }
> {
  throwIfAborted(context, 'decide', 'none')
  let before: CoreAgentObservation | undefined
  try {
    before = await ports.observe(name, context)
  } catch (error) {
    if (context.signal.aborted) throw signalInterruption(context.signal, 'decide', 'none')
    return {
      kind: 'terminal',
      outcome: failure('decision-indeterminate', 'decide', 'none', errorReason(error), false),
    }
  }
  throwIfAborted(context, 'decide', 'none')
  if (!before) return { kind: 'terminal', outcome: { kind: 'agent-not-found', name } }

  const directive = decideCoreInstallation(before)
  if (directive.kind === 'interrupted') throw mutationInterruption(directive.outcome, 'decide', 'none')
  if (directive.kind === 'blocked') {
    return {
      kind: 'terminal',
      outcome: failure(
        directive.code === 'conflict' ? 'decision-conflict' : 'decision-indeterminate',
        'decide',
        'none',
        directive.reason,
        false,
      ),
    }
  }
  return { before, directive, kind: 'ready' }
}

async function resolveRecipe(
  input: InstallationRequest,
  before: CoreAgentObservation,
  directive: MutatingDecision,
  context: CoreInvocationContext,
  ports: CoreInstallationExecutorPorts,
): Promise<
  | { readonly kind: 'ready'; readonly value: CoreInstallationRecipe }
  | { readonly kind: 'terminal'; readonly outcome: CoreInstallationExecutionOutcome }
> {
  let resolved: CoreInstallationRecipeResolution
  try {
    resolved = await ports.resolveRecipe({
      context: operationContext(context),
      directive,
      observed: before,
      operation: input.operation,
    })
  } catch (error) {
    if (context.signal.aborted) throw signalInterruption(context.signal, 'decide', 'none')
    return {
      kind: 'terminal',
      outcome: failure('recipe-unavailable', 'decide', 'none', errorReason(error), false),
    }
  }
  throwIfAborted(context, 'decide', 'none')
  if (resolved.kind === 'interrupted') throw mutationInterruption(resolved.outcome, 'decide', 'none')
  if (resolved.kind === 'ready') {
    const reason = invalidRecipeReason(before, resolved.recipe)
    return reason
      ? {
          kind: 'terminal',
          outcome: failure('recipe-unavailable', 'decide', 'none', reason, false),
        }
      : { kind: 'ready', value: resolved.recipe }
  }
  return {
    kind: 'terminal',
    outcome: failure('recipe-unavailable', 'decide', 'none', resolved.reason, resolved.retryable, resolved.remediation),
  }
}

async function confirmNoChange(
  name: string,
  before: CoreAgentObservation,
  directive: Extract<ReadyDecision, { readonly changed: false }>,
  context: CoreInvocationContext,
  ports: CoreInstallationExecutorPorts,
): Promise<CoreInstallationExecutionOutcome> {
  setMutationPhase(context, 'verify', 'none')
  let after: CoreAgentObservation | undefined
  try {
    after = await ports.observe(name, context)
  } catch (error) {
    if (context.signal.aborted) throw signalInterruption(context.signal, 'verify', 'none')
    return failure('verification-failed', 'verify', 'none', errorReason(error), false)
  }
  throwIfAborted(context, 'verify', 'none')
  if (!after) return failure('verification-failed', 'verify', 'none', 'The agent disappeared.', true)

  const confirmed = decideCoreInstallation(after)
  if (
    confirmed.kind !== 'ready' ||
    !('changed' in confirmed) ||
    confirmed.decision !== directive.decision ||
    !optionalBindingsExactlyEqual(confirmed.binding, directive.binding, before.agent.binaryName) ||
    !observationsPreserveRecordedSource(before, after)
  ) {
    if (confirmed.kind === 'interrupted') throw mutationInterruption(confirmed.outcome, 'verify', 'none')
    return failure('verification-failed', 'verify', 'none', 'Fresh observation changed the no-op decision.', true)
  }

  return {
    kind: 'success',
    value: {
      after,
      before,
      ...(directive.binding ? { binding: directive.binding } : {}),
      changed: false,
      decision: directive.decision,
      kind: 'apply',
    },
  }
}

async function recoverFailure(
  recovery: CoreMutationRecovery,
  code: CoreMutationFailure['code'],
  phase: CoreMutationPhase,
  reason: string,
  retryable: boolean,
): Promise<CoreInstallationExecutionOutcome> {
  const recovered = await recovery.recover()
  recovery.close()
  if (recovered.reason) {
    return failure(
      'compensation-failed',
      'compensate',
      recovered.sideEffect,
      `${reason} ${recovered.reason}`,
      false,
      manualRemediation(),
    )
  }
  return failure(
    code,
    phase,
    recovered.sideEffect,
    reason,
    retryable,
    recovered.sideEffect === 'may-remain' ? manualRemediation() : undefined,
  )
}

async function interruptOwned(
  signal: AbortSignal,
  phase: CoreMutationPhase,
  recovery: CoreMutationRecovery,
): Promise<never> {
  const recovered = await recovery.recover()
  recovery.close()
  throw signalInterruption(signal, phase, recovered.sideEffect)
}

async function interruptProvider(
  outcome: CoreMutationInterruptionOutcome,
  phase: CoreMutationPhase,
  recovery: CoreMutationRecovery,
): Promise<never> {
  const recovered = await recovery.recover()
  recovery.close()
  throw mutationInterruption(outcome, phase, recovered.sideEffect)
}

function successPreview(
  before: CoreAgentObservation,
  directive: Extract<ReadyDecision, { readonly changed: false }>,
): CoreInstallationExecutionOutcome {
  return {
    kind: 'success',
    value: {
      before,
      ...(directive.binding ? { binding: directive.binding } : {}),
      decision: directive.decision,
      kind: 'preview',
      wouldChange: false,
    },
  }
}

function providerFailure(
  code: CoreMutationFailure['code'],
  phase: CoreMutationPhase,
  outcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>,
): CoreInstallationExecutionOutcome {
  return failure(
    code,
    phase,
    'may-remain',
    providerReason(outcome),
    providerRetryable(outcome),
    providerRemediation(outcome),
  )
}

function failure(
  code: CoreMutationFailure['code'],
  phase: CoreMutationPhase,
  sideEffect: CoreMutationSideEffect,
  reason: string,
  retryable: boolean,
  remediation?: string,
): CoreInstallationExecutionOutcome {
  return {
    error: { code, phase, reason, ...(remediation ? { remediation } : {}), retryable, sideEffect },
    kind: 'failed',
  }
}

function matchesLiveRecipe(observed: CoreAgentObservation, recipe: CoreInstallationRecipe): boolean {
  return (
    observed.observation.kind === 'present' &&
    observed.executable.present &&
    observed.binding !== undefined &&
    providerBindingsExactlyEqual(observed.binding, recipe.binding, observed.agent.binaryName)
  )
}

function matchesRecordedRecipe(observed: CoreAgentObservation, recipe: CoreInstallationRecipe): boolean {
  const directive = decideCoreInstallation(observed)
  const stateBinding = observed.installedState
    ? resolveStateProviderBinding(observed.agent, observed.installedState)
    : undefined
  const receiptBinding = observed.receipt ? resolveReceiptProviderBinding(observed.receipt) : undefined
  return (
    directive.kind === 'ready' &&
    'changed' in directive &&
    directive.decision === 'already-satisfied' &&
    stateBinding !== undefined &&
    receiptBinding !== undefined &&
    providerBindingsExactlyEqual(stateBinding, recipe.binding, observed.agent.binaryName) &&
    providerBindingsEqual(receiptBinding, recipe.binding, observed.agent.binaryName)
  )
}

function invalidRecipeReason(observed: CoreAgentObservation, recipe: CoreInstallationRecipe): string | undefined {
  if (recipe.installedState.agentName !== observed.agent.name) {
    return 'Resolved recipe state does not target the observed agent.'
  }
  const stateBinding = resolveStateProviderBinding(observed.agent, recipe.installedState)
  if (!stateBinding || !providerBindingsExactlyEqual(stateBinding, recipe.binding, observed.agent.binaryName)) {
    return 'Resolved recipe does not preserve the schema-v2 provider source identity.'
  }
  return undefined
}

function providerBindingsExactlyEqual(
  left: LifecycleProviderBinding,
  right: LifecycleProviderBinding,
  defaultExecutableName?: string,
): boolean {
  return (
    providerBindingsEqual(left, right, defaultExecutableName) &&
    stringArraysEqual(left.target.arguments, right.target.arguments)
  )
}

function stringArraysEqual(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  if (!left || !right) return left === right
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function observationInterruption(
  observed: CoreAgentObservation | undefined,
): CoreMutationInterruptionOutcome | undefined {
  const outcome = observed?.providerOutcome
  return outcome && isInterruption(outcome) ? outcome : undefined
}

function completedSideEffect(completed: CoreInstallationExecutionOutcome | undefined): CoreMutationSideEffect {
  if (!completed) return 'none'
  if (completed.kind === 'failed') return completed.error.sideEffect
  return completed.kind === 'success' && completed.value.kind === 'apply' && completed.value.changed
    ? 'may-remain'
    : 'none'
}

function optionalBindingsExactlyEqual(
  left: LifecycleProviderBinding | undefined,
  right: LifecycleProviderBinding | undefined,
  executable: string,
): boolean {
  if (!left || !right) return left === right
  return providerBindingsExactlyEqual(left, right, executable)
}

function observationsPreserveRecordedSource(before: CoreAgentObservation, after: CoreAgentObservation): boolean {
  const beforeState = before.installedState
    ? resolveStateProviderBinding(before.agent, before.installedState)
    : undefined
  const afterState = after.installedState ? resolveStateProviderBinding(after.agent, after.installedState) : undefined
  if (!optionalBindingsExactlyEqual(beforeState, afterState, before.agent.binaryName)) return false

  const beforeReceipt = before.receipt ? resolveReceiptProviderBinding(before.receipt) : undefined
  const afterReceipt = after.receipt ? resolveReceiptProviderBinding(after.receipt) : undefined
  return optionalBindingsExactlyEqual(beforeReceipt, afterReceipt, before.agent.binaryName)
}

function isMutating(directive: ReadyDecision): directive is MutatingDecision {
  return 'wouldChange' in directive
}

function isInterruption(outcome: ProviderOutcome<unknown>): outcome is CoreMutationInterruptionOutcome {
  return outcome.kind === 'cancelled' || outcome.kind === 'timed-out'
}

function throwIfAborted(
  context: CoreInvocationContext,
  phase: CoreMutationPhase,
  sideEffect: CoreMutationSideEffect,
): void {
  if (context.signal.aborted) throw signalInterruption(context.signal, phase, sideEffect)
}

function operationContext(context: CoreInvocationContext): ProviderOperationContext {
  return { registerCleanup: context.registerCleanup, signal: context.signal, timeoutMs: context.timeoutMs }
}

function providerReason(outcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>): string {
  if ('reason' in outcome && outcome.reason) return outcome.reason
  return outcome.kind === 'unsupported'
    ? `Provider does not support ${outcome.operation}.`
    : `Provider ${outcome.kind} during the lifecycle mutation.`
}

function providerRetryable(outcome: ProviderOutcome<unknown>): boolean {
  return outcome.kind === 'failed'
    ? outcome.retryable
    : outcome.kind === 'unavailable'
      ? (outcome.retryable ?? true)
      : false
}

function providerRemediation(outcome: ProviderOutcome<unknown>): string | undefined {
  return outcome.kind === 'failed' ? outcome.remediation : undefined
}

function manualRemediation(): string {
  return 'Inspect the selected provider target and remove any partial installation manually before retrying.'
}

function errorReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'Core lifecycle operation failed.'
}
