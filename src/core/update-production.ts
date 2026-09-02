import type { AgentDefinition, InstallMethod } from '../agents/types'
import type { AgentExecutableObservation } from '../lifecycle/agent-observation'
import type { ProviderRegistry } from '../providers/registry'
import type { ProviderOperationContext, RegistryPackageUpdateStrategy } from '../providers/types'
import type { InstalledAgentState } from '../state'
import type {
  LifecycleUpdateBatchExecutionPorts,
  LifecycleUpdateBatchPlanningPorts,
  LifecycleUpdateObservedAgent,
  LifecycleUpdateServicePorts,
} from './update-executor'
import { executeAgentSelfUpdate } from '../agent-update'
import { planLifecycleUpdate } from '../lifecycle'
import { observeAgentLifecycle } from '../lifecycle/agent-observation'
import { resolveInstallMethodProviderBinding } from '../lifecycle/provider-binding'
import { getOrderedInstallMethods, withAgentLifecycleLock } from '../package-manager'
import { firstPartyProviderRegistry } from '../providers'
import { getInstalledAgentState, getLifecycleReceipt, lifecycleReceiptStore, loadState } from '../state'
import { getPlatform } from '../utils/detect'
import { resolveAgentExecutablePath } from '../utils/executable-resolution'
import { isResourceLockError } from '../utils/lock'
import { getResolvedBinaryPath, probeInstalledVersion } from '../utils/version'
import { getCoreAgentByNameOrAlias, getCoreAgents } from './agent-catalog'
import { resolveCoreConfigDir } from './production-observation'

export interface CoreUpdateProductionOptions {
  readonly configDir?: string
  readonly dryRun?: boolean
  readonly listRegisteredAgentNames?: LifecycleUpdateBatchPlanningPorts['listRegisteredAgentNames']
  readonly npmBunUpdateStrategy?: RegistryPackageUpdateStrategy
  readonly providerRegistry?: ProviderRegistry
  readonly registerCleanup?: ProviderOperationContext['registerCleanup']
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export type CoreUpdateServicePorts = LifecycleUpdateBatchPlanningPorts & LifecycleUpdateBatchExecutionPorts

/**
 * Production ports for the in-repo Core update engine. Absent from the published SDK entry.
 */
export async function loadProductionCoreUpdatePorts(
  options: CoreUpdateProductionOptions = {},
): Promise<CoreUpdateServicePorts> {
  const npmBunUpdateStrategy =
    options.npmBunUpdateStrategy ?? (await import('../config')).loadConfig().then(c => c.npmBunUpdateStrategy)
  return createProductionCoreUpdatePorts({
    ...options,
    configDir: resolveCoreConfigDir(options.configDir),
    npmBunUpdateStrategy: typeof npmBunUpdateStrategy === 'string' ? npmBunUpdateStrategy : await npmBunUpdateStrategy,
  })
}

export function createProductionCoreUpdatePorts(
  options: CoreUpdateProductionOptions & {
    readonly configDir: string
    readonly npmBunUpdateStrategy: RegistryPackageUpdateStrategy
  },
): CoreUpdateServicePorts {
  const providerRegistry = options.providerRegistry ?? firstPartyProviderRegistry
  const activeSignal = options.signal ?? new AbortController().signal
  const base: LifecycleUpdateServicePorts = {
    clock: () => new Date().toISOString(),
    dryRun: options.dryRun ?? false,
    executeSelfUpdate: executeAgentSelfUpdate,
    observe: name =>
      observeUpdateAgent(name, {
        providerRegistry,
        signal: activeSignal,
        timeoutMs: options.timeoutMs,
      }),
    planLifecycleUpdate,
    providerRegistry,
    registerCleanup: options.registerCleanup,
    signal: activeSignal,
    timeoutMs: options.timeoutMs,
    updateOptions: { updateStrategy: options.npmBunUpdateStrategy },
    withMutationLock: withAgentLifecycleLock,
    writeReceipt: lifecycleReceiptStore.write,
  }

  return {
    ...base,
    classifyMutationLockError: (error: unknown) =>
      isResourceLockError(error) ? { reason: error.message, resource: error.resource } : undefined,
    listRegisteredAgentNames: options.listRegisteredAgentNames ?? (() => getCoreAgents().map(agent => agent.name)),
  }
}

export function createManagedUpdateAgentNameLoader(): LifecycleUpdateBatchPlanningPorts['listRegisteredAgentNames'] {
  return async () => Object.keys((await loadState()).installedAgents)
}

async function observeUpdateAgent(
  agentName: string,
  options: {
    readonly providerRegistry: ProviderRegistry
    readonly signal: AbortSignal
    readonly timeoutMs?: number
  },
): Promise<LifecycleUpdateObservedAgent | undefined> {
  const agent = getCoreAgentByNameOrAlias(agentName)
  if (!agent) return undefined

  const context: ProviderOperationContext = {
    signal: options.signal,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  }
  let installedStatePromise: Promise<InstalledAgentState | undefined> | undefined
  const readInstalledState = (): Promise<InstalledAgentState | undefined> => {
    installedStatePromise ??= getInstalledAgentState(agent.name)
    return installedStatePromise
  }
  const methods = await getOrderedInstallMethods(agent)
  const result = await observeAgentLifecycle(agent, {
    clock: () => new Date().toISOString(),
    inspectExecutable: async () => inspectExecutable(agent, context),
    platform: getPlatform(),
    preferredCatalogBinding: methods[0] ? resolveInstallMethodProviderBinding(agent, methods[0]) : undefined,
    providerRegistry: options.providerRegistry,
    readInstalledState,
    readReceipt: () => getLifecycleReceipt(agent.name),
    resolveExecutablePath: path => getResolvedBinaryPath(path, context),
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })

  return projectObservedAgent(agent, methods, result)
}

function projectObservedAgent(
  agent: AgentDefinition,
  methods: readonly InstallMethod[],
  result: Awaited<ReturnType<typeof observeAgentLifecycle>>,
): LifecycleUpdateObservedAgent {
  return {
    agent: {
      binaryName: agent.binaryName,
      displayName: agent.displayName,
      name: agent.name,
      ...(agent.packages ? { packages: agent.packages } : {}),
      ...(agent.selfUpdate ? { selfUpdate: agent.selfUpdate } : {}),
    },
    ...(result.binding ? { binding: result.binding } : {}),
    capabilities: result.capabilities,
    executable: result.executable,
    ...(result.installedState ? { installedState: result.installedState } : {}),
    methods: [...methods],
    observation: result.observation,
    ...(result.persistedBinding ? { persistedBinding: result.persistedBinding } : {}),
    ...(result.receipt ? { receipt: result.receipt } : {}),
  }
}

async function inspectExecutable(
  agent: AgentDefinition,
  context: ProviderOperationContext,
): Promise<AgentExecutableObservation> {
  const binaryPath = await resolveAgentExecutablePath(agent.binaryName, context)
  if (!binaryPath) return { present: false }
  const version = await probeInstalledVersion(agent.binaryName, agent.versionProbe, context, binaryPath)
  const path = (await getResolvedBinaryPath(binaryPath, context)) ?? binaryPath
  return { path, present: true, version }
}
