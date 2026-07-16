import type {
  ProviderAdapter,
  ProviderBatchUpdateRequest,
  ProviderEvidence,
  ProviderId,
  ProviderMutationEvidence,
  ProviderOutcome,
  ProviderTarget,
  ProviderTargetRequest,
} from '../types'
import {
  interruptedOutcome,
  isInterruptedOperation,
  runContextualOperation,
  runPendingOperation,
} from './pending-operation'

export type SystemPackagePresence = 'absent' | 'present' | 'unknown'

export interface SystemPackageAdapterDependencies {
  readonly contextualMutation?: boolean
  readonly contextualObservation?: boolean
  readonly getInstalledVersion?: (
    target: ProviderTarget,
    context?: import('../types').ProviderOperationContext,
  ) => Promise<string | undefined>
  readonly install: (
    target: ProviderTarget,
    context: import('../types').ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly isAvailable: (context?: import('../types').ProviderOperationContext) => Promise<boolean>
  readonly probePackagePresence: (
    target: ProviderTarget,
    context?: import('../types').ProviderOperationContext,
  ) => Promise<SystemPackagePresence>
  readonly uninstall: (
    target: ProviderTarget,
    context: import('../types').ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly update: (
    target: ProviderTarget,
    context: import('../types').ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly updateMany: (
    targets: readonly ProviderTarget[],
    context: import('../types').ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
}

type SystemPackageProviderId = Extract<ProviderId, 'brew' | 'cargo' | 'deno' | 'mise' | 'pip' | 'uv' | 'winget'>

interface SystemPackageAdapterConfig<Id extends SystemPackageProviderId> {
  readonly commands: {
    readonly install: (target: ProviderTarget) => readonly string[]
    readonly uninstall: (target: ProviderTarget) => readonly string[]
    readonly update: (target: ProviderTarget) => readonly string[]
    readonly updateMany: (targets: readonly ProviderTarget[]) => readonly string[]
  }
  readonly displayName: string
  readonly executable: string
  readonly id: Id
}

export function createSystemPackageAdapter<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  dependencies: SystemPackageAdapterDependencies,
): ProviderAdapter & { readonly id: Id } {
  const observe = async (request: ProviderTargetRequest) => {
    const presence = await runObservation(request.context, dependencies.contextualObservation, () =>
      dependencies.probePackagePresence(request.target, request.context),
    )
    if (isInterruptedOperation(presence)) return interruptedOutcome(presence)

    if (presence.kind === 'rejected' || presence.value === 'unknown') {
      return {
        evidence: [providerEvidence(config.id, `${request.target.id}:presence-unknown`)],
        kind: 'indeterminate' as const,
        reason: `${config.id} could not determine whether ${request.target.id} is installed`,
      }
    }
    if (presence.value === 'absent') {
      return success({
        evidence: [packageEvidence(config.id, request.target.id, 'absent')],
        kind: 'absent' as const,
        target: request.target,
      })
    }

    const version = dependencies.getInstalledVersion
      ? await runObservation(request.context, dependencies.contextualObservation, () =>
          dependencies.getInstalledVersion!(request.target, request.context),
        )
      : undefined
    if (version && isInterruptedOperation(version)) return interruptedOutcome(version)

    return success({
      evidence: [packageEvidence(config.id, request.target.id, 'present')],
      kind: 'present' as const,
      target: request.target,
      ...(version?.kind === 'resolved' && version.value ? { version: version.value } : {}),
    })
  }

  return {
    availability: async context => {
      const available = await runObservation(context, dependencies.contextualObservation, () =>
        dependencies.isAvailable(context),
      )
      if (isInterruptedOperation(available)) return interruptedOutcome(available)
      if (available.kind === 'rejected' || !available.value) {
        return { kind: 'unavailable', reason: `${config.id} executable is unavailable` }
      }
      return success({ executable: config.executable })
    },
    id: config.id,
    install: request =>
      mutate(
        config,
        request,
        'install',
        config.commands.install(request.target),
        dependencies.contextualMutation,
        dependencies.install,
      ),
    observe,
    uninstall: request =>
      mutate(
        config,
        request,
        'uninstall',
        config.commands.uninstall(request.target),
        dependencies.contextualMutation,
        dependencies.uninstall,
      ),
    update: request =>
      mutate(
        config,
        request,
        'update',
        config.commands.update(request.target),
        dependencies.contextualMutation,
        dependencies.update,
      ),
    updateMany: request => updateMany(config, dependencies, request),
    verify: async request => {
      const observation = await observe(request)
      if (observation.kind !== 'success') return observation
      if (observation.value.kind === 'absent') {
        return success({
          evidence: observation.value.evidence ?? [],
          kind: 'unsatisfied' as const,
          reason: `${request.target.id} is not installed through ${config.id}`,
        })
      }
      return success({ evidence: observation.value.evidence ?? [], kind: 'satisfied' as const })
    },
  }
}

function runObservation<T>(
  context: import('../types').ProviderOperationContext,
  contextual: boolean | undefined,
  invoke: () => Promise<T>,
): Promise<import('./pending-operation').PendingOperation<T>> {
  return contextual ? runContextualOperation(context, invoke) : runPendingOperation(context, invoke)
}

function runMutationOperation<T>(
  context: import('../types').ProviderOperationContext,
  contextual: boolean | undefined,
  invoke: () => Promise<T>,
): Promise<import('./pending-operation').PendingOperation<T>> {
  return contextual ? runContextualOperation(context, invoke) : runPendingOperation(context, invoke)
}

async function mutate<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  request: ProviderTargetRequest,
  operationName: 'install' | 'uninstall' | 'update',
  command: readonly string[],
  contextual: boolean | undefined,
  invoke: (
    target: ProviderTarget,
    context: import('../types').ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  const operation = await runMutationOperation(request.context, contextual, () =>
    invoke(request.target, request.context),
  )
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
  const mutationEvidence = evidence(config.id, command)
  if (operation.kind === 'rejected') {
    return failure(config, request.target.id, operationName, command, mutationEvidence, operation.reason)
  }
  if (operation.value.kind !== 'success') {
    return enrichMutationOutcome(operation.value, config, request.target.id, operationName, command, mutationEvidence)
  }
  return success({ evidence: mutationEvidence, target: request.target })
}

async function updateMany<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  dependencies: SystemPackageAdapterDependencies,
  request: ProviderBatchUpdateRequest,
): Promise<ProviderOutcome<ProviderMutationEvidence[]>> {
  const command = config.commands.updateMany(request.targets)
  const operation = await runMutationOperation(request.context, dependencies.contextualMutation, () =>
    dependencies.updateMany(request.targets, request.context),
  )
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
  const mutationEvidence = evidence(config.id, command)
  if (operation.kind === 'rejected') {
    return failure(config, undefined, 'update', command, mutationEvidence, operation.reason)
  }
  if (operation.value.kind !== 'success') {
    return enrichMutationOutcome(operation.value, config, undefined, 'update', command, mutationEvidence)
  }
  return success(request.targets.map(target => ({ evidence: mutationEvidence, target })))
}

function enrichMutationOutcome(
  outcome: Exclude<ProviderOutcome<void>, { readonly kind: 'success' }>,
  config: SystemPackageAdapterConfig<SystemPackageProviderId>,
  targetId: string | undefined,
  operation: 'install' | 'uninstall' | 'update',
  command: readonly string[],
  mutationEvidence: readonly ProviderEvidence[],
): ProviderOutcome<never> {
  if (outcome.kind !== 'failed') return outcome
  const fallback = failure(config, targetId, operation, command, mutationEvidence)
  return {
    ...fallback,
    ...outcome,
    command: outcome.command ?? command,
    evidence: outcome.evidence ?? mutationEvidence,
    reason: outcome.reason.trim() ? outcome.reason : fallback.reason,
    remediation: outcome.remediation ?? fallback.remediation,
  }
}

function failure<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  targetId: string | undefined,
  operation: 'install' | 'uninstall' | 'update',
  command: readonly string[],
  failureEvidence: readonly ProviderEvidence[],
  cause?: string,
): Extract<ProviderOutcome<never>, { readonly kind: 'failed' }> {
  return {
    command,
    evidence: failureEvidence,
    kind: 'failed',
    reason: `${config.id} ${operation} failed${targetId ? ` for ${targetId}` : ''}${cause ? `: ${cause}` : ''}`,
    remediation: `Review ${config.displayName} output and retry the operation.`,
    retryable: false,
  }
}

function evidence(id: string, command: readonly string[]): readonly ProviderEvidence[] {
  return [
    { kind: 'provider', value: id },
    { kind: 'command', value: command.join(' ') },
  ]
}

function providerEvidence(id: string, suffix: string): ProviderEvidence {
  return { kind: 'provider', value: `${id}:${suffix}` }
}

function packageEvidence(id: string, target: string, state: 'absent' | 'present'): ProviderEvidence {
  return { kind: 'package', value: `${id}:${target}:${state}` }
}

function success<T>(value: T): ProviderOutcome<T> {
  return { kind: 'success', value }
}
