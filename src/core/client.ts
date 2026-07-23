import type { AgentDefinition, Platform } from '../agents/types'
import type { LifecycleProviderBinding } from '../lifecycle/provider-evidence'
import type { CoreInstallationExecutionOutcome, CoreInstallationExecutorPorts } from './installation-executor-types'
import type {
  AgentDescriptor,
  AgentInspection,
  AgentMutation,
  AgentMutationError,
  AgentMutationOptions,
  AgentSource,
  CoreError,
  CoreRequestOptions,
  CoreResult,
  CreateQuantexOptions,
  Quantex,
} from './types'
import { runCoreInvocation } from './invocation'
import {
  type CoreAgentObservation,
  type CoreReadPorts,
  createProductionCoreReadPorts,
  resolveCoreConfigDir,
} from './production-observation'

export type CoreInstallationPortsLoader = (configDir: string) => Promise<CoreInstallationExecutorPorts>

export function createQuantex(options: CreateQuantexOptions = {}): Quantex {
  return createQuantexClient(options, createProductionCoreReadPorts())
}

export function createQuantexClient(
  options: CreateQuantexOptions,
  ports: CoreReadPorts,
  loadInstallationPorts: CoreInstallationPortsLoader = loadProductionInstallationPorts,
): Quantex {
  const configDir = resolveCoreConfigDir(options.configDir)
  let installationPorts: Promise<CoreInstallationExecutorPorts> | undefined
  const getInstallationPorts = (): Promise<CoreInstallationExecutorPorts> => {
    installationPorts ??= loadInstallationPorts(configDir)
    return installationPorts
  }

  const mutate = async (
    operation: 'ensure' | 'install',
    name: string,
    requestOptions?: AgentMutationOptions,
  ): Promise<CoreResult<AgentMutation, AgentMutationError>> => {
    const mode = requestOptions?.mode ?? 'apply'
    if (mode !== 'apply' && mode !== 'preview') {
      return failure({
        code: 'invalid-request',
        message: 'mode must be either apply or preview.',
        retryable: false,
      })
    }

    try {
      const outcome = await runCoreInvocation(requestOptions, async context => {
        const [executor, installation] = await Promise.all([import('./installation-executor'), getInstallationPorts()])
        return await executor.executeCoreInstallation({ mode, name, operation }, context, installation)
      })
      if (outcome.kind === 'failure') return failure(projectInvocationMutationError(outcome.error))
      return projectInstallationOutcome(outcome.value)
    } catch (error) {
      return failure(projectMutationUnexpectedError(error))
    }
  }

  return Object.freeze({
    ensure: (name: string, requestOptions?: AgentMutationOptions) => mutate('ensure', name, requestOptions),
    async inspect(name: string, requestOptions?: CoreRequestOptions): Promise<CoreResult<AgentInspection>> {
      try {
        const outcome = await runCoreInvocation(requestOptions, context =>
          ports.inspectAgent(name, { ...context, configDir }),
        )
        if (outcome.kind === 'failure') return failure(outcome.error)
        if (!outcome.value) {
          return failure({
            code: 'agent-not-found',
            details: { name },
            message: `Unknown agent: ${name}`,
            remediation: 'Use list() to discover registered agent names and aliases.',
            retryable: false,
          })
        }
        return success(projectInspection(outcome.value))
      } catch (error) {
        return failure(projectUnexpectedError(error))
      }
    },
    install: (name: string, requestOptions?: AgentMutationOptions) => mutate('install', name, requestOptions),
    async list(requestOptions?: CoreRequestOptions): Promise<CoreResult<readonly AgentDescriptor[]>> {
      try {
        const outcome = await runCoreInvocation(requestOptions, context => ports.listAgents({ ...context, configDir }))
        if (outcome.kind === 'failure') return failure(outcome.error)
        return success(Object.freeze(outcome.value.map(projectAgentDescriptor)))
      } catch (error) {
        return failure(projectUnexpectedError(error))
      }
    },
  })
}

async function loadProductionInstallationPorts(configDir: string): Promise<CoreInstallationExecutorPorts> {
  const production = await import('./installation-production')
  return await production.loadProductionCoreInstallationPorts(configDir)
}

function projectInspection(result: CoreAgentObservation): AgentInspection {
  const agent = projectAgentDescriptor(result.agent)
  const observation = result.observation
  const observedAt = observation.observedAt
  const recordedSource = projectSource(result.persistedBinding)
  const detectedSource = projectSource(result.binding)
  const executablePath =
    result.resolvedBinaryPath ?? (observation.kind === 'present' ? observation.executablePath : result.executable.path)
  const version = observation.kind === 'present' ? observation.version : result.executable.version
  const executable = {
    ...(executablePath ? { executablePath } : {}),
    ...(version ? { version } : {}),
  }
  const base = {
    agent,
    ...(observedAt ? { observedAt } : {}),
  }

  if (observation.kind === 'indeterminate') {
    return Object.freeze({
      ...base,
      ...executable,
      ...(detectedSource ? { detectedSource } : {}),
      reason: observation.reason,
      ...(recordedSource ? { recordedSource } : {}),
      status: 'indeterminate',
    })
  }

  if (observation.drift.kind === 'conflicting-source') {
    return Object.freeze({
      ...base,
      ...executable,
      ...(detectedSource ? { detectedSource } : {}),
      reason: 'Live and recorded installation evidence conflict.',
      ...(recordedSource ? { recordedSource } : {}),
      status: 'conflict',
    })
  }

  if (observation.kind === 'absent') {
    if (observation.drift.kind === 'recorded-absent') {
      if (!recordedSource) {
        return Object.freeze({
          ...base,
          ...executable,
          ...(detectedSource ? { detectedSource } : {}),
          reason: 'Recorded installation evidence cannot be resolved to a supported source.',
          ...(recordedSource ? { recordedSource } : {}),
          status: 'indeterminate',
        })
      }
      return Object.freeze({
        ...base,
        reason: 'The recorded installation source and executable are conclusively absent.',
        recordedSource,
        status: 'stale',
      })
    }
    return Object.freeze({ ...base, status: 'missing' })
  }

  if (observation.drift.kind === 'untracked') {
    return Object.freeze({
      ...base,
      ...executable,
      ...(detectedSource ? { detectedSource } : {}),
      status: 'external',
    })
  }

  const source = recordedSource ?? detectedSource
  if (!source) {
    return Object.freeze({
      ...base,
      ...executable,
      ...(detectedSource ? { detectedSource } : {}),
      reason: 'A present managed installation has no resolvable source evidence.',
      ...(recordedSource ? { recordedSource } : {}),
      status: 'indeterminate',
    })
  }

  return Object.freeze({
    ...base,
    ...executable,
    source,
    status: 'managed',
  })
}

function projectInstallationOutcome(
  outcome: CoreInstallationExecutionOutcome,
): CoreResult<AgentMutation, AgentMutationError> {
  if (outcome.kind === 'agent-not-found') {
    return failure({
      code: 'agent-not-found',
      details: { name: outcome.name },
      message: `Unknown agent: ${outcome.name}`,
      remediation: 'Use list() to discover registered agent names and aliases.',
      retryable: false,
    })
  }
  if (outcome.kind === 'failed') {
    return failure({
      code: outcome.error.code,
      details: { phase: outcome.error.phase, sideEffect: outcome.error.sideEffect },
      message: outcome.error.reason,
      ...(outcome.error.remediation ? { remediation: outcome.error.remediation } : {}),
      retryable: outcome.error.retryable,
    })
  }

  const value = outcome.value
  const source = projectSource(value.binding)
  if (value.kind === 'preview') {
    return success(
      Object.freeze({
        before: projectInspection(value.before),
        decision: value.decision,
        mode: 'preview' as const,
        ...(source ? { source } : {}),
        wouldChange: value.wouldChange,
      }),
    )
  }
  return success(
    Object.freeze({
      after: projectInspection(value.after),
      before: projectInspection(value.before),
      changed: value.changed,
      decision: value.decision,
      mode: 'apply' as const,
      ...(source ? { source } : {}),
    }),
  )
}

function projectAgentDescriptor(agent: AgentDefinition): AgentDescriptor {
  const platforms = (Object.keys(agent.platforms) as Platform[]).filter(
    platform => (agent.platforms[platform]?.length ?? 0) > 0,
  )
  return Object.freeze({
    aliases: Object.freeze([...(agent.lookupAliases ?? [])]),
    binaryName: agent.binaryName,
    displayName: agent.displayName,
    homepage: agent.homepage,
    name: agent.name,
    platforms: Object.freeze(platforms),
  })
}

function projectSource(binding: LifecycleProviderBinding | undefined): AgentSource | undefined {
  if (!binding) return undefined
  return Object.freeze({
    provider: binding.providerId,
    target: binding.target.id,
    targetKind: binding.target.kind,
  })
}

function projectUnexpectedError(error: unknown): CoreError {
  if (isStateError(error)) {
    return {
      code: 'invalid-state',
      message: `Quantex state could not be read safely: ${errorReason(error)}`,
      remediation: 'Repair or restore state.json before retrying; Core did not replace it.',
      retryable: false,
    }
  }
  return {
    code: 'inspection-failed',
    message: errorReason(error),
    retryable: false,
  }
}

function projectMutationUnexpectedError(error: unknown): AgentMutationError {
  if (isStateError(error)) {
    return {
      code: 'invalid-state',
      message: `Quantex state could not be read safely: ${errorReason(error)}`,
      remediation: 'Repair or restore state.json before retrying; Core did not replace it.',
      retryable: false,
    }
  }
  return {
    code: 'execution-failed',
    details: { phase: 'decide', sideEffect: 'none' },
    message: 'Core mutation could not start safely.',
    remediation: 'Retry the request; if it continues to fail, verify the installed Core package.',
    retryable: false,
  }
}

function projectInvocationMutationError(error: CoreError): AgentMutationError {
  switch (error.code) {
    case 'cancelled':
    case 'invalid-request':
    case 'timed-out':
      return { ...error, code: error.code }
    default:
      return {
        code: 'execution-failed',
        details: { phase: 'decide', sideEffect: 'none' },
        message: 'Core mutation could not start safely.',
        remediation: 'Retry the request; if it continues to fail, verify the installed Core package.',
        retryable: false,
      }
  }
}

function isStateError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'StateSchemaError' || error.name === 'StateFileError')
}

function errorReason(error: unknown, fallback = 'Core inspection failed.'): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function success<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value }
}

function failure<E extends CoreError>(error: E): { readonly error: E; readonly ok: false } {
  return { error, ok: false }
}
