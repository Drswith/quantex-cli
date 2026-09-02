import type { CoreUninstallExecutionOutcome, CoreUninstallExecutorPorts } from './uninstall-executor'
import { createProductionCoreUninstallPorts, executeCoreUninstall } from './uninstall-executor'

export interface CoreUninstallCompatibilityRequest {
  readonly dryRun?: boolean
  readonly isCancelled?: () => boolean
  readonly name: string
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface CoreUninstallCompatibilityExecutor {
  execute(request: CoreUninstallCompatibilityRequest): Promise<CoreUninstallExecutionOutcome>
}

/**
 * Internal CLI bridge for Core-owned uninstall. Absent from the published SDK entry point.
 */
export function createCoreUninstallCompatibilityExecutor(
  options: {
    readonly loadPorts?: (request: CoreUninstallCompatibilityRequest) => CoreUninstallExecutorPorts
  } = {},
): CoreUninstallCompatibilityExecutor {
  const loadPorts =
    options.loadPorts ??
    ((request: CoreUninstallCompatibilityRequest) =>
      createProductionCoreUninstallPorts({
        dryRun: request.dryRun,
        isCancelled: request.isCancelled,
        signal: request.signal,
        timeoutMs: request.timeoutMs,
      }))

  return Object.freeze({
    execute(request: CoreUninstallCompatibilityRequest) {
      return executeCoreUninstall({ name: request.name }, loadPorts(request))
    },
  })
}
