import type {
  ProviderAdapter,
  ProviderBatchUpdateRequest,
  ProviderEvidence,
  ProviderId,
  ProviderMutationEvidence,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
  ProviderTargetRequest,
  RegistryPackageOperationOptions,
  RegistryPackageUpdateStrategy,
} from '../types'
import { normalizeRegistryUrl } from '../../utils/registry'
import {
  interruptedOutcome,
  isInterruptedOperation,
  runContextualOperation,
  runPendingOperation,
} from './pending-operation'

export type RegistryPackagePresence = 'absent' | 'present' | 'unknown'

export interface RegistryPackageAdapterDependencies {
  readonly contextualMutation?: boolean
  readonly getInstalledVersion: (packageName: string, context?: ProviderOperationContext) => Promise<string | undefined>
  readonly install: (
    packageName: string,
    distTag: string | undefined,
    registry: string | undefined,
    context: ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly isAvailable: (context?: ProviderOperationContext) => Promise<boolean>
  readonly probePackagePresence: (
    packageName: string,
    context?: ProviderOperationContext,
  ) => Promise<RegistryPackagePresence>
  readonly contextualPackageObservation?: boolean
  readonly resolveLatestVersion: (
    packageName: string,
    distTag: string,
    registry?: string,
  ) => Promise<string | undefined>
  readonly uninstall: (packageName: string, context: ProviderOperationContext) => Promise<ProviderOutcome<void>>
  readonly update: (
    packageName: string,
    strategy: RegistryPackageUpdateStrategy,
    distTag: string,
    registry: string | undefined,
    context: ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
  readonly updateMany: (
    packageNames: string[],
    strategy: RegistryPackageUpdateStrategy,
    context: ProviderOperationContext,
  ) => Promise<ProviderOutcome<void>>
}

export interface RegistryPackageCommandBuilders {
  readonly install: (target: ProviderTarget, options: ResolvedRegistryPackageOptions) => readonly string[]
  readonly uninstall: (target: ProviderTarget) => readonly string[]
  readonly update: (target: ProviderTarget, options: ResolvedRegistryPackageOptions) => readonly string[]
  readonly updateMany: (
    targets: readonly ProviderTarget[],
    options: ResolvedRegistryPackageOptions,
  ) => readonly string[]
}

export interface ResolvedRegistryPackageOptions {
  readonly distTag: string
  readonly distTagExplicit: boolean
  readonly registry?: string
  readonly updateStrategy: RegistryPackageUpdateStrategy
}

interface RegistryPackageAdapterConfig<Id extends Extract<ProviderId, 'bun' | 'npm'>> {
  readonly commands: RegistryPackageCommandBuilders
  readonly displayName: string
  readonly executable: string
  readonly id: Id
}

export function createRegistryPackageAdapter<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  dependencies: RegistryPackageAdapterDependencies,
): ProviderAdapter & { readonly id: Id } {
  const providerEvidence = evidence('provider', config.id)

  const observe = async (request: ProviderTargetRequest) => {
    const presence = await runPackageObservation(request.context, dependencies.contextualPackageObservation, () =>
      dependencies.probePackagePresence(request.target.id, request.context),
    )
    if (isInterruptedOperation(presence)) return interruptedOutcome(presence)

    if (presence.kind === 'rejected' || presence.value === 'unknown') {
      const providerProbeEvidence = evidence('provider', `${config.id}:${request.target.id}:presence-unknown`)
      return {
        evidence: [providerProbeEvidence],
        kind: 'indeterminate' as const,
        reason: `${config.id} could not determine whether ${request.target.id} is installed`,
      }
    }

    if (presence.value === 'absent') {
      return success({
        evidence: [evidence('package', `${config.id}:${request.target.id}:absent`)],
        kind: 'absent' as const,
        target: request.target,
      })
    }

    const installedVersion = await runPackageObservation(
      request.context,
      dependencies.contextualPackageObservation,
      () => dependencies.getInstalledVersion(request.target.id, request.context),
    )
    if (isInterruptedOperation(installedVersion)) return interruptedOutcome(installedVersion)

    const version = installedVersion.kind === 'resolved' ? installedVersion.value : undefined
    return success({
      evidence: [
        evidence(
          'package',
          version ? `${config.id}:${request.target.id}@${version}` : `${config.id}:${request.target.id}:present`,
        ),
      ],
      kind: 'present' as const,
      target: request.target,
      ...(version ? { version } : {}),
    })
  }

  return {
    availability: async context => {
      const available = await runPackageObservation(context, dependencies.contextualPackageObservation, () =>
        dependencies.isAvailable(context),
      )
      if (isInterruptedOperation(available)) return interruptedOutcome(available)

      if (available.kind === 'rejected' || !available.value) {
        return { kind: 'unavailable', reason: `${config.id} executable is unavailable` }
      }

      return success({ executable: config.executable })
    },
    id: config.id,
    install: request => {
      const options = resolveOptions(request.options)
      const command = config.commands.install(request.target, options)
      return mutate(config, request.context, request.target, command, dependencies.contextualMutation, () =>
        dependencies.install(request.target.id, request.options?.distTag, options.registry, request.context),
      )
    },
    observe,
    resolveLatestVersion: async request => {
      const options = resolveOptions(request.options)
      const resolvedVersion = await runPendingOperation(request.context, () =>
        dependencies.resolveLatestVersion(request.target.id, options.distTag, options.registry),
      )
      if (isInterruptedOperation(resolvedVersion)) return interruptedOutcome(resolvedVersion)

      if (resolvedVersion.kind === 'rejected' || !resolvedVersion.value) {
        return {
          evidence: [providerEvidence],
          kind: 'indeterminate',
          reason: `${config.id} could not resolve the ${options.distTag} version for ${request.target.id}`,
        }
      }

      return success({
        evidence: [
          providerEvidence,
          evidence('package', `${config.id}:${request.target.id}@${options.distTag}=${resolvedVersion.value}`),
        ],
        version: resolvedVersion.value,
      })
    },
    uninstall: request => {
      const command = config.commands.uninstall(request.target)
      return mutate(config, request.context, request.target, command, dependencies.contextualMutation, () =>
        dependencies.uninstall(request.target.id, request.context),
      )
    },
    update: request => {
      const options = resolveOptions(request.options)
      const command = config.commands.update(request.target, options)
      return mutate(config, request.context, request.target, command, dependencies.contextualMutation, () =>
        dependencies.update(
          request.target.id,
          options.updateStrategy,
          options.distTag,
          options.registry,
          request.context,
        ),
      )
    },
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

      return success({
        evidence: observation.value.evidence ?? [],
        kind: 'satisfied' as const,
      })
    },
  }
}

function runPackageObservation<T>(
  context: ProviderOperationContext,
  contextual: boolean | undefined,
  invoke: () => Promise<T>,
): Promise<import('./pending-operation').PendingOperation<T>> {
  return contextual ? runContextualOperation(context, invoke) : runPendingOperation(context, invoke)
}

function runMutationOperation<T>(
  context: ProviderOperationContext,
  contextual: boolean | undefined,
  invoke: () => Promise<T>,
): Promise<import('./pending-operation').PendingOperation<T>> {
  return contextual ? runContextualOperation(context, invoke) : runPendingOperation(context, invoke)
}

async function updateMany<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  dependencies: RegistryPackageAdapterDependencies,
  request: ProviderBatchUpdateRequest,
): Promise<ProviderOutcome<ProviderMutationEvidence[]>> {
  const options = resolveOptions(request.options)
  const command = config.commands.updateMany(request.targets, options)
  const commandEvidence = [evidence('provider', config.id), evidence('command', command.join(' '))]
  const operation = await runMutationOperation(request.context, dependencies.contextualMutation, () =>
    dependencies.updateMany(
      request.targets.map(target => target.id),
      options.updateStrategy,
      request.context,
    ),
  )
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)

  if (operation.kind === 'rejected') {
    return failure(config, command, commandEvidence, 'update-many', undefined, operation.reason)
  }
  if (operation.value.kind !== 'success') {
    return enrichMutationOutcome(operation.value, config, command, commandEvidence, 'update-many')
  }

  return success(request.targets.map(target => ({ evidence: commandEvidence, target })))
}

async function mutate<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  context: ProviderOperationContext,
  target: ProviderTarget,
  command: readonly string[],
  contextual: boolean | undefined,
  invoke: () => Promise<ProviderOutcome<void>>,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  const operation = await runMutationOperation(context, contextual, invoke)
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)

  const mutationEvidence = [evidence('provider', config.id), evidence('command', command.join(' '))]
  if (operation.kind === 'rejected') {
    return failure(config, command, mutationEvidence, command[1] ?? 'operation', target.id, operation.reason)
  }
  if (operation.value.kind !== 'success') {
    return enrichMutationOutcome(
      operation.value,
      config,
      command,
      mutationEvidence,
      command[1] ?? 'operation',
      target.id,
    )
  }

  return success({ evidence: mutationEvidence, target })
}

function enrichMutationOutcome(
  outcome: Exclude<ProviderOutcome<void>, { readonly kind: 'success' }>,
  config: RegistryPackageAdapterConfig<'bun' | 'npm'>,
  command: readonly string[],
  mutationEvidence: readonly ProviderEvidence[],
  operation: string,
  targetId?: string,
): ProviderOutcome<never> {
  if (outcome.kind !== 'failed') return outcome
  const fallback = failure(config, command, mutationEvidence, operation, targetId)
  return {
    ...fallback,
    ...outcome,
    command: outcome.command ?? command,
    evidence: outcome.evidence ?? mutationEvidence,
    reason: outcome.reason.trim() ? outcome.reason : fallback.reason,
    remediation: outcome.remediation ?? fallback.remediation,
  }
}

function failure<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  command: readonly string[],
  providerEvidence: readonly ProviderEvidence[],
  operation: string,
  targetId?: string,
  cause?: string,
): Extract<ProviderOutcome<never>, { readonly kind: 'failed' }> {
  const normalizedOperation = operation === 'add' ? 'install' : operation === 'remove' ? 'uninstall' : operation
  return {
    command,
    evidence: providerEvidence,
    kind: 'failed',
    reason: `${config.id} ${normalizedOperation} failed${targetId ? ` for ${targetId}` : ''}${cause ? `: ${cause}` : ''}`,
    remediation: `Review ${config.displayName} output and retry the operation.`,
    retryable: false,
  }
}

function resolveOptions(options: RegistryPackageOperationOptions | undefined): ResolvedRegistryPackageOptions {
  return {
    distTag: options?.distTag ?? 'latest',
    distTagExplicit: options?.distTag !== undefined,
    registry: normalizeRegistryUrl(options?.registry),
    updateStrategy: options?.updateStrategy ?? 'latest-major',
  }
}

function evidence(kind: ProviderEvidence['kind'], value: string): ProviderEvidence {
  return { kind, value }
}

function success<T>(value: T): ProviderOutcome<T> {
  return { kind: 'success', value }
}
