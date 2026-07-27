import type { Platform } from '../agents/types'
import type { LifecycleProviderBinding } from '../lifecycle/provider-binding'
import type { ProviderRegistry } from '../providers/registry'
import type { ProviderAdapter, ProviderOperationContext, ProviderOutcome, ProviderTarget } from '../providers/types'
import type { InstalledAgentState } from '../state/schema'
import type { CoreInstallationDirective } from './installation-decision'
import type { CoreInstallationRecipe, CoreInstallationRecipeResolution } from './installation-executor-types'
import type { CoreMutationRecipe, CoreMutationRecipeCatalog } from './mutation-recipe-catalog'
import type { CoreAgentObservation } from './production-observation'
import {
  resolveInstallMethodProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../lifecycle/provider-binding'

type MutatingInstallationDirective = Extract<CoreInstallationDirective, { readonly wouldChange: true }>

export interface ResolveCoreInstallationRecipeInput {
  readonly catalog: CoreMutationRecipeCatalog
  readonly context: ProviderOperationContext
  readonly directive: MutatingInstallationDirective
  readonly observed: CoreAgentObservation
  readonly operation: 'ensure' | 'install'
  readonly platform: Platform
  readonly providerRegistry: ProviderRegistry
}

interface ResolvedCandidate {
  readonly recipe: CoreInstallationRecipe
}

export async function resolveCoreInstallationRecipe(
  input: ResolveCoreInstallationRecipeInput,
): Promise<CoreInstallationRecipeResolution> {
  if (input.context.signal.aborted) return cancelled(input.context.signal)

  const catalogEntries = input.catalog.filter(entry => entry.name === input.observed.agent.name)
  if (catalogEntries.length !== 1) {
    return blocked(
      catalogEntries.length === 0
        ? `No mutation recipes are registered for ${input.observed.agent.name}.`
        : `Multiple mutation recipe entries are registered for ${input.observed.agent.name}.`,
      false,
    )
  }

  const sources = catalogEntries[0]!.platforms[input.platform] ?? []
  if (sources.length === 0) {
    return blocked(`${input.observed.agent.displayName} has no ${input.operation} recipe for ${input.platform}.`, false)
  }

  let candidates: readonly ResolvedCandidate[]
  try {
    candidates = sources.map(source => projectCandidate(input.observed, source))
  } catch (error) {
    return blocked(errorReason(error, 'Mutation recipe projection failed.'), false)
  }

  if (input.directive.decision === 'reinstall') {
    return resolveExactStaleRecipe(input, candidates)
  }

  const ordered = orderMissingCandidates(input.observed, candidates)
  if (ordered.kind === 'blocked') return ordered
  return probeMissingCandidates(input, ordered.candidates)
}

async function resolveExactStaleRecipe(
  input: ResolveCoreInstallationRecipeInput,
  candidates: readonly ResolvedCandidate[],
): Promise<CoreInstallationRecipeResolution> {
  const installedState = input.observed.installedState
  if (!installedState) {
    return blocked('Stale installation evidence has no schema-v2 installed-agent source.', false)
  }

  const stateBinding = resolveStateProviderBinding(input.observed.agent, installedState)
  if (!stateBinding) return blocked('The recorded installed-agent source cannot be resolved.', false)

  const requiredBinding = input.directive.decision === 'reinstall' ? input.directive.requiredBinding : undefined
  if (!requiredBinding) return blocked('The stale decision has no exact required provider source.', false)
  if (!bindingsEqual(stateBinding, requiredBinding, input.observed.agent.binaryName, hasArguments(requiredBinding))) {
    return blocked('The stale decision no longer matches the installed-agent source.', false)
  }

  if (
    input.observed.persistedBinding &&
    !bindingsEqual(
      stateBinding,
      input.observed.persistedBinding,
      input.observed.agent.binaryName,
      hasArguments(input.observed.persistedBinding),
    )
  ) {
    return blocked('Persisted provider evidence conflicts with the installed-agent source.', false)
  }

  if (input.observed.receipt) {
    const receiptBinding = resolveReceiptProviderBinding(input.observed.receipt)
    if (!receiptBinding || !bindingsEqual(stateBinding, receiptBinding, input.observed.agent.binaryName, false)) {
      return blocked('The lifecycle receipt conflicts with the installed-agent source.', false)
    }
  }

  const exact = candidates.filter(candidate =>
    bindingsEqual(candidate.recipe.binding, stateBinding, input.observed.agent.binaryName, true),
  )
  if (exact.length !== 1) {
    return blocked(
      exact.length === 0
        ? 'The exact recorded source is no longer present in the mutation catalog.'
        : 'The mutation catalog contains multiple recipes for the exact recorded source.',
      false,
    )
  }

  return probeCandidate(input, exact[0]!, false)
}

function orderMissingCandidates(
  observed: CoreAgentObservation,
  candidates: readonly ResolvedCandidate[],
):
  | { readonly candidates: readonly ResolvedCandidate[]; readonly kind: 'ready' }
  | Extract<CoreInstallationRecipeResolution, { kind: 'blocked' }> {
  const remaining = new Set(candidates.map((_, index) => index))
  const ordered: ResolvedCandidate[] = []

  for (const method of observed.methods) {
    const binding = resolveInstallMethodProviderBinding(observed.agent, method)
    if (!binding) return blocked('An ordered install method cannot be resolved to a provider recipe.', false)

    const index = [...remaining].find(candidateIndex =>
      bindingsEqual(candidates[candidateIndex]!.recipe.binding, binding, observed.agent.binaryName, true),
    )
    if (index === undefined) {
      return blocked('The ordered install methods and generated mutation recipes do not match.', false)
    }
    ordered.push(candidates[index]!)
    remaining.delete(index)
  }

  if (remaining.size > 0) {
    return blocked('The generated mutation recipes contain candidates absent from the ordered install methods.', false)
  }
  return { candidates: ordered, kind: 'ready' }
}

async function probeMissingCandidates(
  input: ResolveCoreInstallationRecipeInput,
  candidates: readonly ResolvedCandidate[],
): Promise<CoreInstallationRecipeResolution> {
  const unavailableReasons: string[] = []
  let retryable = false

  for (const candidate of candidates) {
    const resolution = await probeCandidate(input, candidate, true)
    if (resolution.kind === 'ready' || resolution.kind === 'interrupted') return resolution
    if (!resolution.reason.startsWith('provider-unavailable:')) return resolution

    unavailableReasons.push(resolution.reason.slice('provider-unavailable:'.length))
    retryable ||= resolution.retryable
  }

  return blocked(
    unavailableReasons.length > 0
      ? `No installation provider is currently available: ${unavailableReasons.join('; ')}`
      : `No usable ${input.operation} recipe is available.`,
    retryable,
  )
}

async function probeCandidate(
  input: ResolveCoreInstallationRecipeInput,
  candidate: ResolvedCandidate,
  allowUnavailableFallback: boolean,
): Promise<CoreInstallationRecipeResolution> {
  const adapter = input.providerRegistry.get(candidate.recipe.binding.providerId)
  if (!adapter) {
    return blocked(`Provider ${candidate.recipe.binding.providerId} is not registered.`, false)
  }
  if (!adapter.install || !adapter.verify) {
    return blocked(`Provider ${adapter.id} does not implement both install and verify.`, false)
  }

  const availability = await callProvider(
    () => adapter.availability(input.context),
    adapter,
    'availability',
    input.context,
  )
  if (availability.kind === 'interrupted') return interrupted(availability.outcome)
  if (availability.kind === 'threw') return blocked(availability.reason, false)
  if (availability.outcome.kind === 'cancelled' || availability.outcome.kind === 'timed-out') {
    return interrupted(availability.outcome)
  }
  if (availability.outcome.kind === 'unavailable') {
    const reason = `${adapter.id}: ${availability.outcome.reason}`
    return allowUnavailableFallback
      ? blocked(`provider-unavailable:${reason}`, availability.outcome.retryable ?? true)
      : blocked(`The exact recorded provider is unavailable: ${reason}`, availability.outcome.retryable ?? true)
  }
  if (availability.outcome.kind !== 'success') {
    return blocked(
      providerOutcomeReason(adapter, 'availability', availability.outcome),
      providerRetryable(availability.outcome),
    )
  }

  if (input.context.signal.aborted) return cancelled(input.context.signal)
  const observation = await callProvider(
    () => adapter.observe({ context: input.context, target: candidate.recipe.binding.target }),
    adapter,
    'observation',
    input.context,
  )
  if (observation.kind === 'interrupted') return interrupted(observation.outcome)
  if (observation.kind === 'threw') return blocked(observation.reason, false)
  if (observation.outcome.kind === 'cancelled' || observation.outcome.kind === 'timed-out') {
    return interrupted(observation.outcome)
  }
  if (observation.outcome.kind !== 'success') {
    return blocked(
      providerOutcomeReason(adapter, 'observation', observation.outcome),
      providerRetryable(observation.outcome),
    )
  }
  if (
    !targetsEqual(observation.outcome.value.target, candidate.recipe.binding.target) ||
    !argumentsEqual(observation.outcome.value.target.arguments, candidate.recipe.binding.target.arguments)
  ) {
    return blocked(`Provider ${adapter.id} returned evidence for a different target.`, false)
  }
  if (observation.outcome.value.kind === 'present') {
    return blocked(`Provider ${adapter.id} reports the selected target became present before mutation.`, true)
  }

  return { kind: 'ready', recipe: candidate.recipe }
}

async function callProvider<T>(
  invoke: () => Promise<ProviderOutcome<T>>,
  adapter: ProviderAdapter,
  operation: string,
  context: ProviderOperationContext,
): Promise<
  | {
      readonly kind: 'interrupted'
      readonly outcome: Extract<ProviderOutcome<never>, { kind: 'cancelled' | 'timed-out' }>
    }
  | { readonly kind: 'outcome'; readonly outcome: ProviderOutcome<T> }
  | { readonly kind: 'threw'; readonly reason: string }
> {
  try {
    return { kind: 'outcome', outcome: await invoke() }
  } catch (error) {
    const interruption = thrownInterruption(error, context)
    if (interruption) return { kind: 'interrupted', outcome: interruption }
    return {
      kind: 'threw',
      reason: `Provider ${adapter.id} ${operation} rejected: ${errorReason(error, 'unexpected provider rejection')}`,
    }
  }
}

function projectCandidate(observed: CoreAgentObservation, source: CoreMutationRecipe): ResolvedCandidate {
  const target = projectRuntimeTarget(observed, source)
  return {
    recipe: {
      binding: { providerId: source.provider, target },
      compensation: source.provider === 'script' || source.provider === 'binary' ? 'manual' : 'provider-uninstall',
      installedState: projectInstalledState(observed, source, target),
      ownership: 'created-on-success',
    },
  }
}

function projectRuntimeTarget(observed: CoreAgentObservation, source: CoreMutationRecipe): ProviderTarget {
  const effectProvider = source.provider === 'script' || source.provider === 'binary'
  const effect = source.target.effect
  if (effectProvider && !effect) throw new Error(`${source.provider} recipe is missing its execution effect.`)
  if (!effectProvider && effect) throw new Error(`${source.provider} recipe unexpectedly contains an execution effect.`)

  const id = effectProvider ? renderEffectCommand(effect!) : source.target.id
  const defaultBinary = source.provider === 'deno' || effectProvider
  return {
    ...(source.target.arguments?.length ? { arguments: [...source.target.arguments] } : {}),
    ...(source.target.binaryName || defaultBinary
      ? { binaryName: source.target.binaryName ?? observed.agent.binaryName }
      : {}),
    ...(effect
      ? {
          effect:
            effect.kind === 'executable'
              ? { command: [...effect.command], kind: effect.kind }
              : { command: effect.command, kind: effect.kind },
        }
      : {}),
    id,
    kind: source.target.kind,
  }
}

function projectInstalledState(
  observed: CoreAgentObservation,
  source: CoreMutationRecipe,
  target: ProviderTarget,
): InstalledAgentState {
  const effectProvider = source.provider === 'script' || source.provider === 'binary'
  if (effectProvider) {
    return {
      agentName: observed.agent.name,
      ...(source.target.binaryName ? { binaryName: source.target.binaryName } : {}),
      command: target.id,
      installType: source.provider,
    }
  }

  return {
    agentName: observed.agent.name,
    ...(source.target.binaryName || source.provider === 'deno'
      ? { binaryName: source.target.binaryName ?? observed.agent.binaryName }
      : {}),
    installType: source.provider,
    ...(source.target.arguments?.length ? { packageInstallArgs: [...source.target.arguments] } : {}),
    packageName: source.target.id,
    ...(source.target.kind === 'cask' || source.target.kind === 'id' ? { packageTargetKind: source.target.kind } : {}),
  }
}

function renderEffectCommand(effect: NonNullable<ProviderTarget['effect']>): string {
  if (effect.kind === 'shell-script') return effect.command
  return effect.command.map(renderCommandArgument).join(' ')
}

function renderCommandArgument(argument: string): string {
  return argument.includes(' ') ? JSON.stringify(argument) : argument
}

function bindingsEqual(
  left: LifecycleProviderBinding,
  right: LifecycleProviderBinding,
  defaultBinaryName: string,
  compareArguments: boolean,
): boolean {
  return (
    left.providerId === right.providerId &&
    targetsEqual(left.target, right.target, defaultBinaryName) &&
    (!compareArguments || argumentsEqual(left.target.arguments, right.target.arguments))
  )
}

function targetsEqual(left: ProviderTarget, right: ProviderTarget, defaultBinaryName?: string): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    (left.binaryName ?? defaultBinaryName) === (right.binaryName ?? defaultBinaryName)
  )
}

function argumentsEqual(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  const leftArguments = left ?? []
  const rightArguments = right ?? []
  return (
    leftArguments.length === rightArguments.length &&
    leftArguments.every((argument, index) => argument === rightArguments[index])
  )
}

function hasArguments(binding: LifecycleProviderBinding): boolean {
  return (binding.target.arguments?.length ?? 0) > 0
}

function thrownInterruption(
  error: unknown,
  context: ProviderOperationContext,
): Extract<ProviderOutcome<never>, { kind: 'cancelled' | 'timed-out' }> | undefined {
  if (error && typeof error === 'object' && 'kind' in error) {
    if (error.kind === 'timed-out') {
      const timeoutMs =
        'timeoutMs' in error && typeof error.timeoutMs === 'number' ? error.timeoutMs : context.timeoutMs
      if (timeoutMs !== undefined && Number.isInteger(timeoutMs) && timeoutMs > 0) {
        return { kind: 'timed-out', timeoutMs }
      }
    }
    if (error.kind === 'cancelled') {
      const reason = 'reason' in error ? error.reason : undefined
      return { kind: 'cancelled', ...(reason === undefined ? {} : { reason: String(reason) }) }
    }
  }
  if (context.signal.aborted) {
    const reason = context.signal.reason
    return { kind: 'cancelled', ...(reason === undefined ? {} : { reason: errorReason(reason, 'cancelled') }) }
  }
  return undefined
}

function interrupted(
  outcome: Extract<ProviderOutcome<unknown>, { readonly kind: 'cancelled' | 'timed-out' }>,
): CoreInstallationRecipeResolution {
  return { kind: 'interrupted', outcome }
}

function cancelled(signal: AbortSignal): CoreInstallationRecipeResolution {
  const reason = signal.reason instanceof Error ? signal.reason.message : signal.reason
  return {
    kind: 'interrupted',
    outcome: { kind: 'cancelled', ...(reason === undefined ? {} : { reason: String(reason) }) },
  }
}

function blocked(reason: string, retryable: boolean): Extract<CoreInstallationRecipeResolution, { kind: 'blocked' }> {
  return { kind: 'blocked', reason, retryable }
}

function providerOutcomeReason(
  adapter: ProviderAdapter,
  operation: string,
  outcome: Exclude<ProviderOutcome<unknown>, { readonly kind: 'success' }>,
): string {
  if ('reason' in outcome && outcome.reason) return `Provider ${adapter.id} ${operation} failed: ${outcome.reason}`
  return outcome.kind === 'unsupported'
    ? `Provider ${adapter.id} does not support ${outcome.operation}.`
    : `Provider ${adapter.id} ${operation} returned ${outcome.kind}.`
}

function providerRetryable(outcome: ProviderOutcome<unknown>): boolean {
  if (outcome.kind === 'failed') return outcome.retryable
  if (outcome.kind === 'unavailable') return outcome.retryable ?? true
  return false
}

function errorReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}
