import type { AgentDefinition, InstallMethod } from '../agents'
import type { ProviderOperationContext } from '../providers'
import type { InstalledAgentState } from '../state'
import type { LifecycleObservationService, ResolvedAgentObservation } from './lifecycle-observations'
import type { CoreAgentObservation, CoreInvocationContext, CoreReadPorts } from '@quantex/core/internal'
import { createProductionCoreReadPorts, resolveCoreConfigDir, runCoreInvocation } from '@quantex/core/internal'
import { join } from 'node:path'
import { getAgentByNameOrAlias } from '../agents'
import { firstPartyProviderRegistry } from '../providers'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { StateFileError } from '../state'
import { StateSchemaError } from '../state/schema'
import { ProcessInterruptionError } from '../utils/child-process'
import { getLatestVersionPackage } from '../utils/install'
import { getLatestVersion } from '../utils/version'

export interface CoreBackedCliReadDependencies {
  readonly configDir: string
  readonly core: CoreReadPorts
  readonly resolveLatestVersion: (
    agent: AgentDefinition,
    installedState: InstalledAgentState | undefined,
    methods: readonly InstallMethod[],
    context: ProviderOperationContext,
  ) => Promise<string | undefined>
}

export function createCoreBackedCliReadObservationService(
  context?: ProviderOperationContext,
  dependencies: CoreBackedCliReadDependencies = createProductionDependencies(),
): LifecycleObservationService {
  const run = <T>(invoke: (coreContext: CoreInvocationContext) => Promise<T>): Promise<T> =>
    runCoreReadInvocation(context, dependencies.configDir, invoke)

  const enrich = async (
    result: CoreAgentObservation,
    coreContext: CoreInvocationContext,
  ): Promise<ResolvedAgentObservation> => {
    const compatibilityAgent = getAgentByNameOrAlias(result.agent.name) ?? result.agent
    const compatibilityCapabilities =
      result.binding && result.capabilities.length > 0
        ? firstPartyProviderRegistry.getCapabilities(result.binding.providerId)
        : result.capabilities
    return {
      ...result,
      agent: compatibilityAgent,
      capabilities: compatibilityCapabilities,
      latestVersion: await dependencies.resolveLatestVersion(
        result.agent,
        result.installedState,
        result.methods,
        providerContext(coreContext),
      ),
      methods: [...result.methods],
    }
  }

  return {
    observeRegisteredAgents(): Promise<ResolvedAgentObservation[]> {
      return run(async coreContext => {
        const agents = await dependencies.core.listAgents({
          ...coreContext,
          configDir: dependencies.configDir,
        })
        return Promise.all(
          agents.map(async agent => {
            const observation = await dependencies.core.inspectAgent(agent.name, {
              ...coreContext,
              configDir: dependencies.configDir,
            })
            if (!observation) throw new Error(`Core did not resolve registered agent: ${agent.name}`)
            return enrich(observation, coreContext)
          }),
        )
      })
    },
    resolveAgentObservation(agentName: string): Promise<ResolvedAgentObservation | undefined> {
      return run(async coreContext => {
        const observation = await dependencies.core.inspectAgent(agentName, {
          ...coreContext,
          configDir: dependencies.configDir,
        })
        return observation ? enrich(observation, coreContext) : undefined
      })
    },
  }
}

export function resolveCliReadObservation(
  agentName: string,
  context?: ProviderOperationContext,
): Promise<ResolvedAgentObservation | undefined> {
  return createCoreBackedCliReadObservationService(context).resolveAgentObservation(agentName)
}

export function observeCliReadRegisteredAgents(
  context?: ProviderOperationContext,
): Promise<ResolvedAgentObservation[]> {
  return createCoreBackedCliReadObservationService(context).observeRegisteredAgents()
}

async function runCoreReadInvocation<T>(
  context: ProviderOperationContext | undefined,
  configDir: string,
  invoke: (coreContext: CoreInvocationContext) => Promise<T>,
): Promise<T> {
  const ownedOperation = context ? undefined : createCliOperationContext()
  const operationContext = context ?? ownedOperation?.context
  if (!operationContext) throw new Error('CLI read operation context is unavailable.')

  try {
    const outcome = await runCoreInvocation({ signal: operationContext.signal }, coreContext =>
      invoke({ ...coreContext, timeoutMs: operationContext.timeoutMs }),
    )
    if (outcome.kind === 'failure') throwCoreFailure(outcome.error, operationContext.timeoutMs)
    return outcome.value
  } catch (error) {
    throw normalizeStateReadError(error, configDir)
  } finally {
    ownedOperation?.dispose()
  }
}

function createProductionDependencies(): CoreBackedCliReadDependencies {
  return {
    configDir: resolveCoreConfigDir(),
    core: createProductionCoreReadPorts({ providerRegistry: firstPartyProviderRegistry }),
    async resolveLatestVersion(agent, installedState, methods, context): Promise<string | undefined> {
      const packageName = getLatestVersionPackage(agent, installedState, [...methods])
      return packageName ? getLatestVersion(packageName, 'latest', { context }) : undefined
    },
  }
}

function providerContext(context: CoreInvocationContext): ProviderOperationContext {
  return {
    registerCleanup: context.registerCleanup,
    signal: context.signal,
    timeoutMs: context.timeoutMs,
  }
}

function throwCoreFailure(
  error: {
    readonly code: string
    readonly details?: Readonly<Record<string, unknown>>
    readonly message: string
  },
  configuredTimeoutMs?: number,
): never {
  if (error.code === 'cancelled') {
    const reason = typeof error.details?.reason === 'string' ? error.details.reason : undefined
    throw new ProcessInterruptionError({ kind: 'cancelled', reason })
  }
  if (error.code === 'timed-out') {
    const timeoutMs =
      typeof error.details?.timeoutMs === 'number' ? error.details.timeoutMs : (configuredTimeoutMs ?? 0)
    throw new ProcessInterruptionError({ kind: 'timed-out', timeoutMs })
  }
  throw new Error(error.message)
}

function normalizeStateReadError(error: unknown, configDir: string): unknown {
  if (error instanceof StateFileError || error instanceof ProcessInterruptionError) return error
  if (error instanceof StateSchemaError) {
    return new StateFileError(`Failed to read Quantex state file: ${error.message}`, { cause: error })
  }
  if (isStateFileSystemError(error, join(configDir, 'state.json'))) {
    return new StateFileError('Failed to read Quantex state file.', { cause: error })
  }
  return error
}

function isStateFileSystemError(error: unknown, stateFilePath: string): boolean {
  if (!error || typeof error !== 'object' || !('path' in error)) return false
  return String(error.path) === stateFilePath
}
