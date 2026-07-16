import type { LifecycleOutcome } from '../lifecycle'
import type { ProcessPort, RuntimeFailure, RuntimeOutcome } from '../runtime'
import type { LifecycleObservationService, LifecycleObservationServiceOptions } from './lifecycle-observations'
import { cancelCliContextOperations } from '../cli-context'
import { reconcileAgentInstallation } from '../lifecycle'
import { createAgentProcessPort, createCliOperationContext } from '../runtime'
import { getStateFilePath, StateFileError } from '../state'
import { isProcessInterruptionError } from '../utils/child-process'
import {
  type AgentExecutionOutcome,
  type ExecuteAgentLifecycleInput,
  executeAgentLifecycle,
  type LifecycleExecutionObservedAgent,
} from './lifecycle-execution'
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
  readonly createObservationService: (
    context: ProductionOperationContext['context'],
    options: LifecycleObservationServiceOptions,
  ) => LifecycleObservationService
  readonly createOperationContext: () => ProductionOperationContext
  readonly createProcessPort: () => ProcessPort
  readonly reconcileAgentInstallation: typeof reconcileAgentInstallation
}

export interface ProductionLifecycleExecutionService {
  dispose(): void
  execute(input: ExecuteAgentLifecycleInput): Promise<AgentExecutionOutcome>
}

const defaultDependencies: ProductionLifecycleExecutionDependencies = {
  cancelOperations: cancelCliContextOperations,
  createObservationService: createProductionLifecycleObservationService,
  createOperationContext: createCliOperationContext,
  createProcessPort: createAgentProcessPort,
  reconcileAgentInstallation,
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

  return {
    dispose: operation.dispose,
    execute: input =>
      executeAgentLifecycle(input, {
        confirmInstall: options.confirmInstall,
        dryRun: options.dryRun,
        install: observed => installAgent(observed, options.timeoutMs, dependencies),
        interactive: options.interactive,
        observe: agentName => observeAgent(agentName, observationService),
        onInstallStart: options.onInstallStart,
        outputMode: options.outputMode,
        process,
        signal: operation.context.signal,
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

async function installAgent(
  observed: LifecycleExecutionObservedAgent,
  timeoutMs: number | undefined,
  dependencies: ProductionLifecycleExecutionDependencies,
): Promise<LifecycleOutcome<void>> {
  try {
    if (observed.executable.present) return { kind: 'success', value: undefined }

    const reconciliation = dependencies.reconcileAgentInstallation({
      agent: observed.agent,
      observation: {
        inPath: observed.executable.present,
        installedState: observed.installedState,
        lifecycle: observed.observation,
        methods: observed.methods,
      },
      operation: 'install',
      route: 'install',
    })
    const outcome = await withInstallTimeout(reconciliation, timeoutMs, dependencies.cancelOperations)
    if (!outcome) return { kind: 'timed-out', timeoutMs: timeoutMs! }
    if (outcome.kind === 'success') return { kind: 'success', value: undefined }
    return outcome
  } catch (error) {
    if (isProcessInterruptionError(error)) {
      return error.kind === 'timed-out'
        ? { kind: 'timed-out', timeoutMs: timeoutMs ?? 0 }
        : { kind: 'cancelled', reason: error.message }
    }
    return { kind: 'failed', reason: errorReason(error, 'Failed to install agent.'), retryable: false }
  }
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
