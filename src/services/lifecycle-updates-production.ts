import type {
  CoreUpdateBatchInvocation,
  CoreSingleAgentUpdateInvocation,
  CoreUpdateBatchOutcome,
  CoreUpdateSingleOutcome,
} from '../core/update-compatibility'
import type {
  LifecycleUpdateBatchExecutionPorts,
  LifecycleUpdateBatchPlanningPorts,
  LifecycleUpdateServicePorts,
} from '../core/update-executor'
import { executeAgentSelfUpdate } from '../agent-update'
import { getAllAgents } from '../agents'
import { loadConfig } from '../config'
import {
  executeLifecycleUpdateBatch,
  executeSingleAgentLifecycleUpdate,
  planRegisteredAgentUpdates,
  planSingleAgentLifecycleUpdate,
} from '../core/update-executor'
import { planLifecycleUpdate } from '../lifecycle'
import { withAgentLifecycleLock } from '../package-manager'
import { firstPartyProviderRegistry } from '../providers'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { lifecycleReceiptStore, loadState } from '../state'
import { isResourceLockError } from '../utils/lock'
import { isDryRunEnabled } from '../utils/user-output'
import { createProductionLifecycleObservationService } from './lifecycle-observations'

export type RunSingleAgentLifecycleUpdateOutcome = CoreUpdateSingleOutcome
export type RunLifecycleUpdateBatchOutcome = CoreUpdateBatchOutcome

export type SingleAgentLifecycleUpdateInvocation = CoreSingleAgentUpdateInvocation
export type LifecycleUpdateBatchInvocation = CoreUpdateBatchInvocation

/**
 * CLI production adapter over the in-repo Core update executor.
 * Supplies CLI cancellation/timeout/observation context; Core owns plan/execute/verify/record.
 */
export async function runLifecycleUpdateBatch(): Promise<RunLifecycleUpdateBatchOutcome> {
  const invocation = createLifecycleUpdateBatchInvocation()
  try {
    return await invocation.run()
  } finally {
    invocation.dispose()
  }
}

export function createLifecycleUpdateBatchInvocation(): LifecycleUpdateBatchInvocation {
  return createCliBackedBatchInvocation(() => getAllAgents().map(agent => agent.name))
}

export function createManagedLifecycleUpdateBatchInvocation(): LifecycleUpdateBatchInvocation {
  return createCliBackedBatchInvocation(async () => Object.keys((await loadState()).installedAgents))
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
  let outcome: CoreUpdateSingleOutcome | undefined
  let planningPromise: Promise<Awaited<ReturnType<typeof planSingleAgentLifecycleUpdate>>> | undefined
  let portsPromise: Promise<LifecycleUpdateServicePorts> | undefined
  let runPromise: Promise<CoreUpdateSingleOutcome> | undefined

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
    portsPromise ??= loadCliUpdatePorts(operation)
    return portsPromise
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
    prepare() {
      if (disposed) return Promise.reject(new Error('Single-agent update invocation has been disposed.'))
      planningPromise ??= runWhileActive(async () => planSingleAgentLifecycleUpdate(agentName, await resolvePorts()))
      return planningPromise
    },
    run() {
      if (disposed) return Promise.reject(new Error('Single-agent update invocation has been disposed.'))
      runPromise ??= (async () => {
        const planning = await prepareThroughActive()
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

  function prepareThroughActive() {
    if (disposed) return Promise.reject(new Error('Single-agent update invocation has been disposed.'))
    planningPromise ??= runWhileActive(async () => planSingleAgentLifecycleUpdate(agentName, await resolvePorts()))
    return planningPromise
  }
}

function createCliBackedBatchInvocation(
  listRegisteredAgentNames: LifecycleUpdateBatchPlanningPorts['listRegisteredAgentNames'],
): LifecycleUpdateBatchInvocation {
  const operation = createCliOperationContext()
  let activeOperations = 0
  let disposed = false
  let operationDisposed = false
  let outcome: CoreUpdateBatchOutcome | undefined
  let planningPromise: Promise<Awaited<ReturnType<typeof planRegisteredAgentUpdates>>> | undefined
  let portsPromise: Promise<LifecycleUpdateBatchPlanningPorts & LifecycleUpdateBatchExecutionPorts> | undefined
  let runPromise: Promise<CoreUpdateBatchOutcome> | undefined

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
    portsPromise ??= loadCliUpdatePorts(operation).then(ports => ({
      ...ports,
      classifyMutationLockError: (error: unknown) =>
        isResourceLockError(error) ? { reason: error.message, resource: error.resource } : undefined,
      listRegisteredAgentNames,
    }))
    return portsPromise
  }

  const prepare = (): Promise<Awaited<ReturnType<typeof planRegisteredAgentUpdates>>> => {
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

async function loadCliUpdatePorts(
  operation: ReturnType<typeof createCliOperationContext>,
): Promise<LifecycleUpdateServicePorts> {
  const config = await loadConfig()
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
}
