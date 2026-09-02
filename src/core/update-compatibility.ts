import type {
  LifecycleUpdateBatchOutcome,
  LifecycleUpdateBatchPlan,
  SingleAgentLifecycleUpdateExecutionOutcome,
  SingleAgentLifecycleUpdatePlanningOutcome,
} from './update-executor'
import type { CoreUpdateServicePorts } from './update-production'
import {
  executeLifecycleUpdateBatch,
  executeSingleAgentLifecycleUpdate,
  planRegisteredAgentUpdates,
  planSingleAgentLifecycleUpdate,
} from './update-executor'
import { createManagedUpdateAgentNameLoader, loadProductionCoreUpdatePorts } from './update-production'

export type CoreUpdateSingleOutcome =
  | Exclude<SingleAgentLifecycleUpdatePlanningOutcome, { readonly kind: 'planned' }>
  | SingleAgentLifecycleUpdateExecutionOutcome

export type CoreUpdateBatchOutcome = LifecycleUpdateBatchOutcome

export interface CoreUpdateCompatibilityExecutorOptions {
  readonly configDir?: string
  readonly dryRun?: boolean
  readonly loadPorts?: () => Promise<CoreUpdateServicePorts>
  readonly registerCleanup?: CoreUpdateServicePorts['registerCleanup']
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

/**
 * Internal CLI bridge for Core-owned update. Absent from the published SDK entry point.
 */
export interface CoreSingleAgentUpdateInvocation {
  dispose(): void
  getOutcome(): CoreUpdateSingleOutcome | undefined
  observe(agentName: string): ReturnType<CoreUpdateServicePorts['observe']>
  prepare(): Promise<SingleAgentLifecycleUpdatePlanningOutcome>
  run(): Promise<CoreUpdateSingleOutcome>
}

export interface CoreUpdateBatchInvocation {
  dispose(): void
  getOutcome(): CoreUpdateBatchOutcome | undefined
  observe(agentName: string): ReturnType<CoreUpdateServicePorts['observe']>
  prepare(): Promise<LifecycleUpdateBatchPlan>
  run(): Promise<CoreUpdateBatchOutcome>
}

export function createCoreSingleAgentUpdateInvocation(
  agentName: string,
  options: CoreUpdateCompatibilityExecutorOptions = {},
): CoreSingleAgentUpdateInvocation {
  let disposed = false
  let outcome: CoreUpdateSingleOutcome | undefined
  let planningPromise: Promise<SingleAgentLifecycleUpdatePlanningOutcome> | undefined
  let portsPromise: Promise<CoreUpdateServicePorts> | undefined
  let runPromise: Promise<CoreUpdateSingleOutcome> | undefined

  const resolvePorts = (): Promise<CoreUpdateServicePorts> => {
    portsPromise ??=
      options.loadPorts?.() ??
      loadProductionCoreUpdatePorts({
        configDir: options.configDir,
        dryRun: options.dryRun,
        registerCleanup: options.registerCleanup,
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      })
    return portsPromise
  }

  return {
    dispose() {
      disposed = true
    },
    getOutcome: () => outcome,
    async observe(targetAgentName) {
      if (disposed) throw new Error('Core update invocation has been disposed.')
      return (await resolvePorts()).observe(targetAgentName)
    },
    prepare() {
      if (disposed) return Promise.reject(new Error('Core update invocation has been disposed.'))
      planningPromise ??= resolvePorts().then(ports => planSingleAgentLifecycleUpdate(agentName, ports))
      return planningPromise
    },
    run() {
      if (disposed) return Promise.reject(new Error('Core update invocation has been disposed.'))
      runPromise ??= (async () => {
        const planning = await this.prepare()
        if (disposed) throw new Error('Core update invocation has been disposed.')
        outcome =
          planning.kind === 'planned'
            ? await executeSingleAgentLifecycleUpdate(planning.planned, await resolvePorts())
            : planning
        return outcome
      })()
      return runPromise
    },
  }
}

export function createCoreUpdateBatchInvocation(
  scope: 'all' | 'managed',
  options: CoreUpdateCompatibilityExecutorOptions = {},
): CoreUpdateBatchInvocation {
  let disposed = false
  let outcome: CoreUpdateBatchOutcome | undefined
  let planningPromise: Promise<LifecycleUpdateBatchPlan> | undefined
  let portsPromise: Promise<CoreUpdateServicePorts> | undefined
  let runPromise: Promise<CoreUpdateBatchOutcome> | undefined

  const resolvePorts = (): Promise<CoreUpdateServicePorts> => {
    portsPromise ??=
      options.loadPorts?.() ??
      loadProductionCoreUpdatePorts({
        configDir: options.configDir,
        dryRun: options.dryRun,
        listRegisteredAgentNames: scope === 'managed' ? createManagedUpdateAgentNameLoader() : undefined,
        registerCleanup: options.registerCleanup,
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      })
    return portsPromise
  }

  return {
    dispose() {
      disposed = true
    },
    getOutcome: () => outcome,
    async observe(agentName) {
      if (disposed) throw new Error('Core update batch invocation has been disposed.')
      return (await resolvePorts()).observe(agentName)
    },
    prepare() {
      if (disposed) return Promise.reject(new Error('Core update batch invocation has been disposed.'))
      planningPromise ??= resolvePorts().then(ports => planRegisteredAgentUpdates(ports))
      return planningPromise
    },
    run() {
      if (disposed) return Promise.reject(new Error('Core update batch invocation has been disposed.'))
      runPromise ??= (async () => {
        const plan = await this.prepare()
        if (disposed) throw new Error('Core update batch invocation has been disposed.')
        outcome = await executeLifecycleUpdateBatch(plan, await resolvePorts())
        return outcome
      })()
      return runPromise
    },
  }
}

export async function runCoreSingleAgentUpdate(
  agentName: string,
  options: CoreUpdateCompatibilityExecutorOptions = {},
): Promise<CoreUpdateSingleOutcome> {
  const invocation = createCoreSingleAgentUpdateInvocation(agentName, options)
  try {
    return await invocation.run()
  } finally {
    invocation.dispose()
  }
}

export async function runCoreUpdateBatch(
  scope: 'all' | 'managed' = 'all',
  options: CoreUpdateCompatibilityExecutorOptions = {},
): Promise<CoreUpdateBatchOutcome> {
  const invocation = createCoreUpdateBatchInvocation(scope, options)
  try {
    return await invocation.run()
  } finally {
    invocation.dispose()
  }
}
