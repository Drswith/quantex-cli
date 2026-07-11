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
import { interruptedOutcome, isInterruptedOperation, runPendingOperation } from './legacy-operation'

export type RegistryPackagePresence = 'absent' | 'present' | 'unknown'

export interface RegistryPackageAdapterDependencies {
  readonly getInstalledVersion: (packageName: string) => Promise<string | undefined>
  readonly install: (packageName: string, distTag?: string, registry?: string) => Promise<boolean>
  readonly isAvailable: () => Promise<boolean>
  readonly probePackagePresence: (packageName: string) => Promise<RegistryPackagePresence>
  readonly resolveLatestVersion: (
    packageName: string,
    distTag: string,
    registry?: string,
  ) => Promise<string | undefined>
  readonly uninstall: (packageName: string) => Promise<boolean>
  readonly update: (
    packageName: string,
    strategy: RegistryPackageUpdateStrategy,
    distTag: string,
    registry?: string,
  ) => Promise<boolean>
  readonly updateMany: (packageNames: string[], strategy: RegistryPackageUpdateStrategy) => Promise<boolean>
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
    const presence = await runPendingOperation(request.context, () =>
      dependencies.probePackagePresence(request.target.id),
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

    const installedVersion = await runPendingOperation(request.context, () =>
      dependencies.getInstalledVersion(request.target.id),
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
      const available = await runPendingOperation(context, () => dependencies.isAvailable())
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
      return mutate(config, request.context, request.target, command, () =>
        dependencies.install(request.target.id, request.options?.distTag, options.registry),
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
      return mutate(config, request.context, request.target, command, () => dependencies.uninstall(request.target.id))
    },
    update: request => {
      const options = resolveOptions(request.options)
      const command = config.commands.update(request.target, options)
      return mutate(config, request.context, request.target, command, () =>
        dependencies.update(request.target.id, options.updateStrategy, options.distTag, options.registry),
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

async function updateMany<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  dependencies: RegistryPackageAdapterDependencies,
  request: ProviderBatchUpdateRequest,
): Promise<ProviderOutcome<ProviderMutationEvidence[]>> {
  const options = resolveOptions(request.options)
  const command = config.commands.updateMany(request.targets, options)
  const commandEvidence = [evidence('provider', config.id), evidence('command', command.join(' '))]
  const operation = await runPendingOperation(request.context, () =>
    dependencies.updateMany(
      request.targets.map(target => target.id),
      options.updateStrategy,
    ),
  )
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)

  if (operation.kind === 'rejected' || !operation.value) {
    return failure(
      config,
      command,
      commandEvidence,
      'update-many',
      undefined,
      operation.kind === 'rejected' ? operation.reason : undefined,
    )
  }

  return success(request.targets.map(target => ({ evidence: commandEvidence, target })))
}

async function mutate<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  context: ProviderOperationContext,
  target: ProviderTarget,
  command: readonly string[],
  invoke: () => Promise<boolean>,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  const operation = await runPendingOperation(context, invoke)
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)

  const mutationEvidence = [evidence('provider', config.id), evidence('command', command.join(' '))]
  if (operation.kind === 'rejected' || !operation.value) {
    return failure(
      config,
      command,
      mutationEvidence,
      command[1] ?? 'operation',
      target.id,
      operation.kind === 'rejected' ? operation.reason : undefined,
    )
  }

  return success({ evidence: mutationEvidence, target })
}

function failure<Id extends Extract<ProviderId, 'bun' | 'npm'>>(
  config: RegistryPackageAdapterConfig<Id>,
  command: readonly string[],
  providerEvidence: readonly ProviderEvidence[],
  operation: string,
  targetId?: string,
  cause?: string,
): ProviderOutcome<never> {
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
