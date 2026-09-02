import type {
  CoreUpdateBatchInvocation,
  CoreSingleAgentUpdateInvocation,
  CoreUpdateBatchOutcome,
  CoreUpdateCompatibilityExecutorOptions,
  CoreUpdateSingleOutcome,
} from '../core/update-compatibility'
import { createCoreSingleAgentUpdateInvocation, createCoreUpdateBatchInvocation } from '../core/update-compatibility'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { isDryRunEnabled } from '../utils/user-output'

export type RunSingleAgentLifecycleUpdateOutcome = CoreUpdateSingleOutcome
export type RunLifecycleUpdateBatchOutcome = CoreUpdateBatchOutcome

export type SingleAgentLifecycleUpdateInvocation = CoreSingleAgentUpdateInvocation
export type LifecycleUpdateBatchInvocation = CoreUpdateBatchInvocation

/**
 * CLI production adapter over in-repo Core update-compatibility.
 * Owns CLI cancellation/timeout/operation-context wrapping only; Core owns
 * plan/execute/verify/record and production update ports.
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
  return createCliWrappedBatchInvocation('all')
}

export function createManagedLifecycleUpdateBatchInvocation(): LifecycleUpdateBatchInvocation {
  return createCliWrappedBatchInvocation('managed')
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

function createCliWrappedBatchInvocation(scope: 'all' | 'managed'): LifecycleUpdateBatchInvocation {
  const operation = createCliOperationContext()
  let activeOperations = 0
  let disposed = false
  let operationDisposed = false
  const core = createCoreUpdateBatchInvocation(scope, coreOptionsFrom(operation))

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
    registerCleanup: operation.context.registerCleanup,
    signal: operation.context.signal,
    timeoutMs: operation.context.timeoutMs,
  }
}
