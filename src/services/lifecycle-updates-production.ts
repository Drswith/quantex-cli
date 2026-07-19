import type {
  LifecycleUpdateBatchExecutionPorts,
  LifecycleUpdateBatchOutcome,
  LifecycleUpdateBatchPlan,
  LifecycleUpdateBatchPlanningPorts,
  LifecycleUpdateServicePorts,
  SingleAgentLifecycleUpdateExecutionOutcome,
  SingleAgentLifecycleUpdatePlanningOutcome,
} from './lifecycle-updates'
import { executeAgentSelfUpdate } from '../agent-update'
import { getAllAgents } from '../agents'
import { loadConfig } from '../config'
import { planLifecycleUpdate } from '../lifecycle'
import { withAgentLifecycleLock } from '../package-manager'
import { firstPartyProviderRegistry } from '../providers'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { lifecycleReceiptStore } from '../state'
import { isResourceLockError } from '../utils/lock'
import { isDryRunEnabled } from '../utils/user-output'
import { createProductionLifecycleObservationService } from './lifecycle-observations'
import {
  executeLifecycleUpdateBatch,
  executeSingleAgentLifecycleUpdate,
  planRegisteredAgentUpdates,
  planSingleAgentLifecycleUpdate,
} from './lifecycle-updates'

export type RunSingleAgentLifecycleUpdateOutcome =
  | Exclude<SingleAgentLifecycleUpdatePlanningOutcome, { readonly kind: 'planned' }>
  | SingleAgentLifecycleUpdateExecutionOutcome

export type RunLifecycleUpdateBatchOutcome = LifecycleUpdateBatchOutcome

export interface SingleAgentLifecycleUpdateInvocation {
  dispose(): void
  getOutcome(): RunSingleAgentLifecycleUpdateOutcome | undefined
  observe(agentName: string): ReturnType<LifecycleUpdateServicePorts['observe']>
  prepare(): Promise<SingleAgentLifecycleUpdatePlanningOutcome>
  run(): Promise<RunSingleAgentLifecycleUpdateOutcome>
}

export interface LifecycleUpdateBatchInvocation {
  dispose(): void
  getOutcome(): RunLifecycleUpdateBatchOutcome | undefined
  observe(agentName: string): ReturnType<LifecycleUpdateServicePorts['observe']>
  prepare(): Promise<LifecycleUpdateBatchPlan>
  run(): Promise<RunLifecycleUpdateBatchOutcome>
}

export async function runLifecycleUpdateBatch(): Promise<RunLifecycleUpdateBatchOutcome> {
  const invocation = createLifecycleUpdateBatchInvocation()
  try {
    return await invocation.run()
  } finally {
    invocation.dispose()
  }
}

export function createLifecycleUpdateBatchInvocation(): LifecycleUpdateBatchInvocation {
  const operation = createCliOperationContext()
  let activeOperations = 0
  let disposed = false
  let operationDisposed = false
  let outcome: RunLifecycleUpdateBatchOutcome | undefined
  let planningPromise: Promise<LifecycleUpdateBatchPlan> | undefined
  let portsPromise: Promise<LifecycleUpdateBatchPlanningPorts & LifecycleUpdateBatchExecutionPorts> | undefined
  let runPromise: Promise<RunLifecycleUpdateBatchOutcome> | undefined

  const disposeOperationIfIdle = (): void => {
    if (!disposed || operationDisposed || activeOperations > 0) return
    operationDisposed = true
    operation.dispose()
  }

  const runWhileActive = async <T>(invoke: () => Promise<T>): Promise<T> => {
    if (disposed) throw new Error('Lifecycle update batch invocation has been disposed.')
    activeOperations += 1
    try {
      return await operation.run(invoke)
    } finally {
      activeOperations -= 1
      disposeOperationIfIdle()
    }
  }

  const resolvePorts = (): Promise<LifecycleUpdateBatchPlanningPorts & LifecycleUpdateBatchExecutionPorts> => {
    portsPromise ??= loadConfig().then(config => {
      const observationService = createProductionLifecycleObservationService(operation.context)
      return {
        classifyMutationLockError: (error: unknown) =>
          isResourceLockError(error) ? { reason: error.message, resource: error.resource } : undefined,
        clock: () => new Date().toISOString(),
        dryRun: isDryRunEnabled(),
        executeSelfUpdate: executeAgentSelfUpdate,
        listRegisteredAgentNames: () => getAllAgents().map(agent => agent.name),
        observe: observationService.resolveAgentObservation,
        planLifecycleUpdate,
        providerRegistry: firstPartyProviderRegistry,
        registerCleanup: operation.context.registerCleanup,
        signal: operation.context.signal,
        timeoutMs: operation.context.timeoutMs,
        updateOptions: { updateStrategy: config.npmBunUpdateStrategy },
        withMutationLock: withAgentLifecycleLock,
        writeReceipt: lifecycleReceiptStore.write,
      }
    })
    return portsPromise
  }

  const prepare = (): Promise<LifecycleUpdateBatchPlan> => {
    if (disposed) return Promise.reject(new Error('Lifecycle update batch invocation has been disposed.'))
    planningPromise ??= runWhileActive(async () => planRegisteredAgentUpdates(await resolvePorts()))
    return planningPromise
  }

  return {
    dispose() {
      if (disposed) return
      disposed = true
      disposeOperationIfIdle()
    },
    getOutcome: () => outcome,
    async observe(agentName) {
      return runWhileActive(async () => {
        const ports = await resolvePorts()
        return ports.observe(agentName)
      })
    },
    prepare,
    run() {
      if (disposed) return Promise.reject(new Error('Lifecycle update batch invocation has been disposed.'))
      runPromise ??= (async () => {
        const plan = await prepare()
        outcome = await runWhileActive(async () => executeLifecycleUpdateBatch(plan, await resolvePorts()))
        return outcome
      })()
      return runPromise
    },
  }
}

export async function runSingleAgentLifecycleUpdate(agentName: string): Promise<RunSingleAgentLifecycleUpdateOutcome> {
  const invocation = createSingleAgentLifecycleUpdateInvocation(agentName)
  try {
    return await invocation.run()
  } finally {
    invocation.dispose()
  }
}

export function createSingleAgentLifecycleUpdateInvocation(agentName: string): SingleAgentLifecycleUpdateInvocation {
  const operation = createCliOperationContext()
  let activeOperations = 0
  let disposed = false
  let operationDisposed = false
  let outcome: RunSingleAgentLifecycleUpdateOutcome | undefined
  let planningPromise: Promise<SingleAgentLifecycleUpdatePlanningOutcome> | undefined
  let portsPromise: Promise<LifecycleUpdateServicePorts> | undefined
  let runPromise: Promise<RunSingleAgentLifecycleUpdateOutcome> | undefined

  const disposeOperationIfIdle = (): void => {
    if (!disposed || operationDisposed || activeOperations > 0) return
    operationDisposed = true
    operation.dispose()
  }

  const runWhileActive = async <T>(invoke: () => Promise<T>): Promise<T> => {
    if (disposed) throw new Error('Single-agent update invocation has been disposed.')
    activeOperations += 1
    try {
      return await operation.run(invoke)
    } finally {
      activeOperations -= 1
      disposeOperationIfIdle()
    }
  }

  const resolvePorts = (): Promise<LifecycleUpdateServicePorts> => {
    portsPromise ??= loadConfig().then(config => {
      const observationService = createProductionLifecycleObservationService(operation.context)
      return {
        clock: () => new Date().toISOString(),
        dryRun: isDryRunEnabled(),
        executeSelfUpdate: executeAgentSelfUpdate,
        observe: observationService.resolveAgentObservation,
        planLifecycleUpdate,
        providerRegistry: firstPartyProviderRegistry,
        registerCleanup: operation.context.registerCleanup,
        signal: operation.context.signal,
        timeoutMs: operation.context.timeoutMs,
        updateOptions: { updateStrategy: config.npmBunUpdateStrategy },
        withMutationLock: withAgentLifecycleLock,
        writeReceipt: lifecycleReceiptStore.write,
      }
    })
    return portsPromise
  }

  const prepare = (): Promise<SingleAgentLifecycleUpdatePlanningOutcome> => {
    if (disposed) return Promise.reject(new Error('Single-agent update invocation has been disposed.'))
    planningPromise ??= runWhileActive(async () => planSingleAgentLifecycleUpdate(agentName, await resolvePorts()))
    return planningPromise
  }

  return {
    dispose() {
      if (disposed) return
      disposed = true
      disposeOperationIfIdle()
    },
    getOutcome: () => outcome,
    async observe(targetAgentName) {
      return runWhileActive(async () => {
        const ports = await resolvePorts()
        return ports.observe(targetAgentName)
      })
    },
    prepare,
    run() {
      if (disposed) return Promise.reject(new Error('Single-agent update invocation has been disposed.'))
      runPromise ??= (async () => {
        const planning = await prepare()
        outcome =
          planning.kind === 'planned'
            ? await runWhileActive(async () =>
                executeSingleAgentLifecycleUpdate(planning.planned, await resolvePorts()),
              )
            : planning
        return outcome
      })()
      return runPromise
    },
  }
}
