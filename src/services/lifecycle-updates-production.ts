import type {
  CoreUpdateBatchInvocation,
  CoreSingleAgentUpdateInvocation,
  CoreUpdateBatchOutcome,
  CoreUpdateCompatibilityExecutorOptions,
  CoreUpdateSingleOutcome,
} from '../core/update-compatibility'
import type { LifecycleUpdateBatchPlanningPorts } from '../core/update-executor'
import type { CoreUpdateServicePorts } from '../core/update-production'
import { executeAgentSelfUpdate } from '../agent-update'
import { getAllAgents } from '../agents'
import { loadConfig } from '../config'
import { createCoreSingleAgentUpdateInvocation, createCoreUpdateBatchInvocation } from '../core/update-compatibility'
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
 * CLI production adapter over in-repo Core update-compatibility.
 * Owns CLI cancellation/timeout/operation-context wrapping and the retained CLI
 * observation/lock port wiring; Core owns the plan/execute invocation engine.
 * Does not rewrite other compatibility surfaces outside update routing.
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
  return createCliWrappedBatchInvocation('all', () => getAllAgents().map(agent => agent.name))
}

export function createManagedLifecycleUpdateBatchInvocation(): LifecycleUpdateBatchInvocation {
  return createCliWrappedBatchInvocation('managed', async () => Object.keys((await loadState()).installedAgents))
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
  return createCliWrappedSingleInvocation(agentName)
}

function createCliWrappedSingleInvocation(agentName: string): SingleAgentLifecycleUpdateInvocation {
  const operation = createCliOperationContext()
  let activeOperations = 0
  let disposed = false
  let operationDisposed = false
  const core = createCoreSingleAgentUpdateInvocation(agentName, coreOptionsFrom(operation))

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

  return {
    dispose() {
      if (disposed) return
      disposed = true
      core.dispose()
      disposeOperationIfIdle()
    },
    getOutcome: () => core.getOutcome(),
    observe(targetAgentName) {
      return runWhileActive(() => core.observe(targetAgentName))
    },
    prepare() {
      return runWhileActive(() => core.prepare())
    },
    run() {
      return runWhileActive(() => core.run())
    },
  }
}

function createCliWrappedBatchInvocation(
  scope: 'all' | 'managed',
  listRegisteredAgentNames: LifecycleUpdateBatchPlanningPorts['listRegisteredAgentNames'],
): LifecycleUpdateBatchInvocation {
  const operation = createCliOperationContext()
  let activeOperations = 0
  let disposed = false
  let operationDisposed = false
  const core = createCoreUpdateBatchInvocation(scope, {
    ...coreOptionsFrom(operation),
    loadPorts: async () => {
      const ports = await loadCliUpdatePorts(operation)
      return {
        ...ports,
        classifyMutationLockError: (error: unknown) =>
          isResourceLockError(error) ? { reason: error.message, resource: error.resource } : undefined,
        listRegisteredAgentNames,
      }
    },
  })

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

  return {
    dispose() {
      if (disposed) return
      disposed = true
      core.dispose()
      disposeOperationIfIdle()
    },
    getOutcome: () => core.getOutcome(),
    observe(agentName) {
      return runWhileActive(() => core.observe(agentName))
    },
    prepare() {
      return runWhileActive(() => core.prepare())
    },
    run() {
      return runWhileActive(() => core.run())
    },
  }
}

function coreOptionsFrom(
  operation: ReturnType<typeof createCliOperationContext>,
): CoreUpdateCompatibilityExecutorOptions {
  return {
    dryRun: isDryRunEnabled(),
    loadPorts: () => loadCliUpdatePorts(operation),
    registerCleanup: operation.context.registerCleanup,
    signal: operation.context.signal,
    timeoutMs: operation.context.timeoutMs,
  }
}

/**
 * Retained CLI compatibility port wiring for update observation/locks.
 * Kept deliberately so v1 contracts and install/ensure-adjacent observation
 * surfaces do not drift while the duplicate invocation engine is removed.
 */
async function loadCliUpdatePorts(
  operation: ReturnType<typeof createCliOperationContext>,
): Promise<CoreUpdateServicePorts> {
  const config = await loadConfig()
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
}
