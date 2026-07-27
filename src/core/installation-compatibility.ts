import type { ProviderOutputPolicy, ProviderProcessOperationContext } from '../providers/internal-operation-context'
import type { ProviderOperationContext } from '../providers/types'
import type {
  CoreInstallationExecutionHooks,
  CoreInstallationExecutionOutcome,
  CoreInstallationExecutorPorts,
} from './installation-executor-types'
import type { CoreInvocationOutcome } from './invocation'
import { runCoreInvocation } from './invocation'
import { resolveCoreConfigDir } from './production-observation'

export interface CoreInstallationCompatibilityRequest {
  readonly mode: 'apply' | 'preview'
  readonly name: string
  readonly onMutationStart?: NonNullable<CoreInstallationExecutionHooks['onMutationStart']>
  readonly operation: 'ensure' | 'install'
  readonly outputPolicy: ProviderOutputPolicy
  readonly providerTimeoutMs?: number
  readonly resolveAdoption?: NonNullable<CoreInstallationExecutionHooks['resolveAdoption']>
  readonly signal?: AbortSignal
}

export interface CoreInstallationCompatibilityExecutor {
  execute(
    request: CoreInstallationCompatibilityRequest,
  ): Promise<CoreInvocationOutcome<CoreInstallationExecutionOutcome>>
}

export interface CoreInstallationCompatibilityExecutorOptions {
  readonly configDir?: string
  readonly loadPorts?: (configDir: string) => Promise<CoreInstallationExecutorPorts>
}

/**
 * Internal CLI bridge for the staged 1.x migration. It returns the richer Core
 * outcome needed by the v1 compatibility projector and is deliberately absent
 * from the public SDK entry point.
 */
export function createCoreInstallationCompatibilityExecutor(
  options: CoreInstallationCompatibilityExecutorOptions = {},
): CoreInstallationCompatibilityExecutor {
  const configDir = resolveCoreConfigDir(options.configDir)
  const loadPorts = options.loadPorts ?? loadProductionPorts
  let ports: Promise<CoreInstallationExecutorPorts> | undefined
  const getPorts = (): Promise<CoreInstallationExecutorPorts> => {
    ports ??= loadPorts(configDir)
    return ports
  }

  return Object.freeze({
    execute(
      request: CoreInstallationCompatibilityRequest,
    ): Promise<CoreInvocationOutcome<CoreInstallationExecutionOutcome>> {
      return runCoreInvocation({ signal: request.signal }, async context => {
        const [executor, loadedPorts] = await Promise.all([import('./installation-executor'), getPorts()])
        return await executor.executeCoreInstallation(
          { mode: request.mode, name: request.name, operation: request.operation },
          context,
          withProviderContext(loadedPorts, request.outputPolicy, request.providerTimeoutMs),
          {
            ...(request.onMutationStart ? { onMutationStart: request.onMutationStart } : {}),
            ...(request.resolveAdoption ? { resolveAdoption: request.resolveAdoption } : {}),
          },
        )
      })
    },
  })
}

async function loadProductionPorts(configDir: string): Promise<CoreInstallationExecutorPorts> {
  const production = await import('./installation-production')
  return await production.loadProductionCoreInstallationPorts(configDir)
}

function withProviderContext(
  ports: CoreInstallationExecutorPorts,
  outputPolicy: ProviderOutputPolicy,
  timeoutMs: number | undefined,
): CoreInstallationExecutorPorts {
  const operationContext = (context: ProviderOperationContext): ProviderProcessOperationContext => ({
    ...context,
    outputPolicy,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  })
  const compensationContext = (context: ProviderOperationContext): ProviderProcessOperationContext => ({
    ...context,
    outputPolicy,
  })

  return {
    ...ports,
    compensate: (recipe, context) => ports.compensate(recipe, compensationContext(context)),
    install: (recipe, context) => ports.install(recipe, operationContext(context)),
    observe: (name, context) => ports.observe(name, timeoutMs === undefined ? context : { ...context, timeoutMs }),
    resolveRecipe: input => ports.resolveRecipe({ ...input, context: operationContext(input.context) }),
    verify: (recipe, context) => ports.verify(recipe, operationContext(context)),
  }
}
