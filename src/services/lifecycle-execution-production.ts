import type { CoreInstallationCompatibilityExecutor } from '../core/installation-compatibility'
import type { CoreInstallationExecutionOutcome } from '../core/installation-executor-types'
import type { CoreInvocationOutcome } from '../core/invocation'
import type { CoreAgentObservation } from '../core/production-observation'
import type { LifecycleOutcome } from '../lifecycle'
import type { ProcessPort, RuntimeFailure, RuntimeOutcome } from '../runtime'
import type { LifecycleObservationService, LifecycleObservationServiceOptions } from './lifecycle-observations'
import { cancelCliContextOperations } from '../cli-context'
import {
  type AgentExecutionOutcome,
  type ExecuteAgentLifecycleInput,
  executeAgentLifecycle,
  type LifecycleExecutionObservedAgent,
} from '../core/execution-executor'
import { createCoreInstallationCompatibilityExecutor } from '../core/installation-compatibility'
import { resolveInstallMethodProviderBinding } from '../lifecycle/provider-binding'
import { buildInstalledAgentState } from '../package-manager'
import { createAgentProcessPort, createCliOperationContext } from '../runtime'
import { resolveCliProviderOutputPolicy } from '../runtime/cli-operation-context'
import { getStateFilePath, StateFileError } from '../state'
import { isProcessInterruptionError } from '../utils/child-process'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { createProductionLifecycleObservationService } from './lifecycle-observations'

export interface ProductionLifecycleExecutionOptions {
  readonly confirmInstall: (observed: LifecycleExecutionObservedAgent) => Promise<boolean>
  readonly dryRun: boolean
  readonly interactive: boolean
  readonly outputMode: 'human' | 'json' | 'ndjson'
  readonly onInstallStart?: (observed: LifecycleExecutionObservedAgent) => Promise<void> | void
  readonly timeoutMs?: number
}

interface ProductionOperationContext {
  readonly context: ReturnType<typeof createCliOperationContext>['context']
  dispose(): void
}

export interface ProductionLifecycleExecutionDependencies {
  readonly cancelOperations: typeof cancelCliContextOperations
  readonly createInstallationExecutor: () => CoreInstallationCompatibilityExecutor
  readonly createObservationService: (
    context: ProductionOperationContext['context'],
    options: LifecycleObservationServiceOptions,
  ) => LifecycleObservationService
  readonly createOperationContext: () => ProductionOperationContext
  readonly createProcessPort: () => ProcessPort
}

export interface ProductionLifecycleExecutionService {
  dispose(): void
  execute(input: ExecuteAgentLifecycleInput): Promise<AgentExecutionOutcome>
}

const defaultDependencies: ProductionLifecycleExecutionDependencies = {
  cancelOperations: cancelCliContextOperations,
  createInstallationExecutor: () => createCoreInstallationCompatibilityExecutor(),
  createObservationService: createProductionLifecycleObservationService,
  createOperationContext: createCliOperationContext,
  createProcessPort: createAgentProcessPort,
}

export function createProductionLifecycleExecutionService(
  options: ProductionLifecycleExecutionOptions,
  dependencies: ProductionLifecycleExecutionDependencies = defaultDependencies,
): ProductionLifecycleExecutionService {
  const operation = dependencies.createOperationContext()
  const observationService = dependencies.createObservationService(operation.context, {
    resolveLatestVersion: false,
  })
  const process = dependencies.createProcessPort()
  const installationExecutor = dependencies.createInstallationExecutor()

  return {
    dispose: operation.dispose,
    execute: input =>
      executeAgentLifecycle(input, {
        confirmInstall: options.confirmInstall,
        dryRun: options.dryRun,
        install: observed =>
          installAgent(observed, options.timeoutMs ?? operation.context.timeoutMs, installationExecutor, {
            cancelOperations: dependencies.cancelOperations,
            outputMode: options.outputMode,
            signal: operation.context.signal,
          }),
        interactive: options.interactive,
        observe: agentName => observeAgent(agentName, observationService),
        onInstallStart: options.onInstallStart,
        process,
        signal: operation.context.signal,
        // CLI owns process I/O policy: human inherits agent stdio; structured modes reserve stdout.
        stdio: options.outputMode === 'human' ? ['inherit', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
        timeoutMs: options.timeoutMs,
      }),
  }
}

async function observeAgent(
  agentName: string,
  service: LifecycleObservationService,
): Promise<RuntimeOutcome<LifecycleExecutionObservedAgent | undefined>> {
  try {
    const resolved = await service.resolveAgentObservation(agentName)
    return {
      kind: 'success',
      value: resolved
        ? {
            agent: resolved.agent,
            executable: resolved.pathExecutable,
            installedState: resolved.installedState,
            methods: resolved.methods,
            observation: resolved.observation,
          }
        : undefined,
    }
  } catch (error) {
    return { error: observationFailure(error), kind: 'failure' }
  }
}

interface InstallAgentContext {
  readonly cancelOperations: typeof cancelCliContextOperations
  readonly outputMode: ProductionLifecycleExecutionOptions['outputMode']
  readonly signal: AbortSignal
}

async function installAgent(
  observed: LifecycleExecutionObservedAgent,
  timeoutMs: number | undefined,
  executor: CoreInstallationCompatibilityExecutor,
  context: InstallAgentContext,
): Promise<LifecycleOutcome<void>> {
  try {
    if (observed.executable.present) return { kind: 'success', value: undefined }

    const invocation = await withInstallTimeout(
      executor.execute({
        mode: 'apply',
        name: observed.agent.name,
        operation: 'install',
        outputPolicy: resolveCliProviderOutputPolicy(context.outputMode),
        providerTimeoutMs: timeoutMs,
        resolveAdoption: resolveCompatibilityAdoption,
        signal: context.signal,
      }),
      timeoutMs,
      context.cancelOperations,
    )
    if (!invocation) return { kind: 'timed-out', timeoutMs: timeoutMs! }
    return mapCoreInstallationOutcome(invocation)
  } catch (error) {
    if (isProcessInterruptionError(error)) {
      return error.kind === 'timed-out'
        ? { kind: 'timed-out', timeoutMs: timeoutMs ?? 0 }
        : { kind: 'cancelled', reason: error.message }
    }
    return { kind: 'failed', reason: errorReason(error, 'Failed to install agent.'), retryable: false }
  }
}

function mapCoreInstallationOutcome(
  invocation: CoreInvocationOutcome<CoreInstallationExecutionOutcome>,
): LifecycleOutcome<void> {
  if (invocation.kind === 'failure') {
    if (invocation.error.code === 'cancelled') {
      return { kind: 'cancelled', reason: invocation.error.message }
    }
    if (invocation.error.code === 'timed-out') {
      const timeoutMs = typeof invocation.error.details?.timeoutMs === 'number' ? invocation.error.details.timeoutMs : 0
      return { kind: 'timed-out', timeoutMs }
    }
    return {
      kind: 'failed',
      reason: invocation.error.message || 'Failed to initialize the install lifecycle engine.',
      retryable: invocation.error.retryable,
    }
  }

  const outcome = invocation.value
  if (outcome.kind === 'success') return { kind: 'success', value: undefined }
  if (outcome.kind === 'agent-not-found') {
    return { kind: 'failed', reason: `Unknown agent: ${outcome.name}`, retryable: false }
  }

  if (outcome.error.code === 'decision-indeterminate' || outcome.error.code === 'decision-conflict') {
    return { kind: 'indeterminate', reason: outcome.error.reason }
  }
  return {
    kind: 'failed',
    reason: outcome.error.reason || 'Failed to install agent.',
    retryable: outcome.error.retryable,
  }
}

async function resolveCompatibilityAdoption(before: CoreAgentObservation): Promise<
  | {
      readonly binding: NonNullable<ReturnType<typeof resolveInstallMethodProviderBinding>>
      readonly installedState: ReturnType<typeof buildInstalledAgentState>
    }
  | undefined
> {
  const method = getAdoptableExistingInstallMethod(
    [...before.methods],
    before.resolvedBinaryPath ?? before.pathExecutable.path,
  )
  if (!method) return undefined
  const binding = resolveInstallMethodProviderBinding(before.agent, method)
  if (!binding) return undefined
  return { binding, installedState: buildInstalledAgentState(before.agent, method) }
}

async function withInstallTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number | undefined,
  cancelOperations: typeof cancelCliContextOperations,
): Promise<T | undefined> {
  if (timeoutMs === undefined) return operation

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      operation.then(value => ({ kind: 'completed' as const, value })),
      new Promise<{ readonly kind: 'timed-out' }>(resolve => {
        timeout = setTimeout(() => resolve({ kind: 'timed-out' }), timeoutMs)
      }),
    ])
    if (result.kind === 'completed') return result.value

    const late = await settleWithin(operation, Math.max(1, Math.min(timeoutMs, 250)))
    if (late !== undefined) return late
    await cancelOperations()
    return undefined
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function observationFailure(error: unknown): RuntimeFailure {
  if (error instanceof StateFileError) {
    return {
      code: 'STATE_READ_ERROR',
      details: { stateFilePath: getStateFilePath() },
      kind: 'invalid-data',
      message: error.message,
    }
  }
  if (isProcessInterruptionError(error)) {
    return { kind: error.kind, message: error.message }
  }
  return { kind: 'failed', message: errorReason(error, 'Failed to observe agent execution state.') }
}

function errorReason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

async function settleWithin<T>(promise: Promise<T>, durationMs: number): Promise<T | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>(resolve => {
        timeout = setTimeout(() => resolve(undefined), durationMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
