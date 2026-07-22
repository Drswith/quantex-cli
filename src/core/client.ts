import type { AgentDefinition, Platform } from '../agents/types'
import type { LifecycleProviderBinding } from '../lifecycle/provider-evidence'
import type {
  AgentDescriptor,
  AgentInspection,
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

export function createQuantex(options: CreateQuantexOptions = {}): Quantex {
  return createQuantexClient(options, createProductionCoreReadPorts())
}

export function createQuantexClient(options: CreateQuantexOptions, ports: CoreReadPorts): Quantex {
  const configDir = resolveCoreConfigDir(options.configDir)

  return Object.freeze({
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

function isStateError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'StateSchemaError' || error.name === 'StateFileError')
}

function errorReason(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'Core inspection failed.'
}

function success<T>(value: T): CoreResult<T> {
  return { ok: true, value }
}

function failure<T>(error: CoreError): CoreResult<T> {
  return { error, ok: false }
}
