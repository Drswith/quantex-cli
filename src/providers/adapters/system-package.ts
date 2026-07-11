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
import { interruptedOutcome, isInterruptedOperation, runPendingOperation } from './legacy-operation'

export type SystemPackagePresence = 'absent' | 'present' | 'unknown'

export interface SystemPackageAdapterDependencies {
  readonly getInstalledVersion?: (target: ProviderTarget) => Promise<string | undefined>
  readonly install: (target: ProviderTarget) => Promise<boolean>
  readonly isAvailable: () => Promise<boolean>
  readonly probePackagePresence: (target: ProviderTarget) => Promise<SystemPackagePresence>
  readonly uninstall: (target: ProviderTarget) => Promise<boolean>
  readonly update: (target: ProviderTarget) => Promise<boolean>
  readonly updateMany: (targets: readonly ProviderTarget[]) => Promise<boolean>
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
    const presence = await runPendingOperation(request.context, () => dependencies.probePackagePresence(request.target))
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
      ? await runPendingOperation(request.context, () => dependencies.getInstalledVersion!(request.target))
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
      const available = await runPendingOperation(context, () => dependencies.isAvailable())
      if (isInterruptedOperation(available)) return interruptedOutcome(available)
      if (available.kind === 'rejected' || !available.value) {
        return { kind: 'unavailable', reason: `${config.id} executable is unavailable` }
      }
      return success({ executable: config.executable })
    },
    id: config.id,
    install: request =>
      mutate(config, request, 'install', config.commands.install(request.target), dependencies.install),
    observe,
    uninstall: request =>
      mutate(config, request, 'uninstall', config.commands.uninstall(request.target), dependencies.uninstall),
    update: request => mutate(config, request, 'update', config.commands.update(request.target), dependencies.update),
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

async function mutate<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  request: ProviderTargetRequest,
  operationName: 'install' | 'uninstall' | 'update',
  command: readonly string[],
  invoke: (target: ProviderTarget) => Promise<boolean>,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  const operation = await runPendingOperation(request.context, () => invoke(request.target))
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
  const mutationEvidence = evidence(config.id, command)
  if (operation.kind === 'rejected' || !operation.value) {
    return failure(
      config,
      request.target.id,
      operationName,
      command,
      mutationEvidence,
      operation.kind === 'rejected' ? operation.reason : undefined,
    )
  }
  return success({ evidence: mutationEvidence, target: request.target })
}

async function updateMany<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  dependencies: SystemPackageAdapterDependencies,
  request: ProviderBatchUpdateRequest,
): Promise<ProviderOutcome<ProviderMutationEvidence[]>> {
  const command = config.commands.updateMany(request.targets)
  const operation = await runPendingOperation(request.context, () => dependencies.updateMany(request.targets))
  if (isInterruptedOperation(operation)) return interruptedOutcome(operation)
  const mutationEvidence = evidence(config.id, command)
  if (operation.kind === 'rejected' || !operation.value) {
    return failure(
      config,
      undefined,
      'update',
      command,
      mutationEvidence,
      operation.kind === 'rejected' ? operation.reason : undefined,
    )
  }
  return success(request.targets.map(target => ({ evidence: mutationEvidence, target })))
}

function failure<Id extends SystemPackageProviderId>(
  config: SystemPackageAdapterConfig<Id>,
  targetId: string | undefined,
  operation: 'install' | 'uninstall' | 'update',
  command: readonly string[],
  failureEvidence: readonly ProviderEvidence[],
  cause?: string,
): ProviderOutcome<never> {
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
