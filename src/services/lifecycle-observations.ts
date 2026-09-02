import type { AgentDefinition, InstallMethod, Platform } from '../agents'
import type {
  AgentExecutableObservation,
  AgentLifecycleObservationPorts,
  AgentLifecycleObservationResult,
  LifecycleReceipt,
} from '../lifecycle'
import type { ProviderOperationContext, ProviderRegistry } from '../providers'
import type { InstalledAgentState } from '../state'
import * as agentRegistry from '../agents'
import { observeAgentLifecycle } from '../lifecycle'
import { resolveInstallMethodProviderBinding } from '../lifecycle/provider-binding'
import { getOrderedInstallMethods } from '../package-manager'
import { firstPartyProviderRegistry } from '../providers'
import { createCliOperationContext } from '../runtime/cli-operation-context'
import { getInstalledAgentState, getLifecycleReceipt } from '../state'
import { getPlatform } from '../utils/detect'
import { resolveAgentExecutablePath } from '../utils/executable-resolution'
import { getLatestVersionPackage } from '../utils/install'
import { getLatestVersion, getResolvedBinaryPath, probeInstalledVersion } from '../utils/version'

export interface ResolvedAgentObservation extends AgentLifecycleObservationResult {
  readonly agent: AgentDefinition
  readonly latestVersion?: string
  readonly methods: InstallMethod[]
  readonly resolvedBinaryPath?: string
}

export interface LifecycleObservationServicePorts {
  readonly clock: () => string
  readonly getAllAgents: () => AgentDefinition[]
  readonly getAgentByNameOrAlias: (name: string) => AgentDefinition | undefined
  readonly getLatestVersion: (
    agent: AgentDefinition,
    installedState: InstalledAgentState | undefined,
    methods: InstallMethod[],
  ) => Promise<string | undefined>
  readonly getOrderedInstallMethods: (agent: AgentDefinition) => Promise<InstallMethod[]>
  readonly getPlatform: () => Platform
  readonly getResolvedBinaryPath: (binaryPath?: string) => Promise<string | undefined>
  readonly inspectExecutable: (
    agent: AgentDefinition,
    installedState: InstalledAgentState | undefined,
  ) => Promise<AgentExecutableObservation>
  readonly observeAgentLifecycle: (
    agent: AgentDefinition,
    ports: AgentLifecycleObservationPorts,
  ) => Promise<AgentLifecycleObservationResult>
  readonly providerRegistry: ProviderRegistry
  readonly readInstalledState: (agentName: string) => Promise<InstalledAgentState | undefined>
  readonly readReceipt: (agentName: string) => Promise<LifecycleReceipt | undefined>
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export interface LifecycleObservationService {
  observeRegisteredAgents(): Promise<ResolvedAgentObservation[]>
  resolveAgentObservation(agentName: string): Promise<ResolvedAgentObservation | undefined>
}

export interface LifecycleObservationServiceOptions {
  readonly resolveLatestVersion?: boolean
}

export function createLifecycleObservationService(
  ports: LifecycleObservationServicePorts,
  options: LifecycleObservationServiceOptions = {},
): LifecycleObservationService {
  async function observe(agent: AgentDefinition): Promise<ResolvedAgentObservation> {
    let installedStatePromise: Promise<InstalledAgentState | undefined> | undefined
    const readInstalledState = (): Promise<InstalledAgentState | undefined> => {
      installedStatePromise ??= ports.readInstalledState(agent.name)
      return installedStatePromise
    }
    const methods = await ports.getOrderedInstallMethods(agent)
    const result = await ports.observeAgentLifecycle(agent, {
      clock: ports.clock,
      inspectExecutable: async () => ports.inspectExecutable(agent, await readInstalledState()),
      platform: ports.getPlatform(),
      preferredCatalogBinding: methods[0] ? resolveInstallMethodProviderBinding(agent, methods[0]) : undefined,
      providerRegistry: ports.providerRegistry,
      readInstalledState,
      readReceipt: ports.readReceipt,
      resolveExecutablePath: path => ports.getResolvedBinaryPath(path),
      signal: ports.signal,
      timeoutMs: ports.timeoutMs,
    })
    const [latestVersion, resolvedBinaryPath] = await Promise.all([
      options.resolveLatestVersion === false
        ? Promise.resolve(undefined)
        : ports.getLatestVersion(agent, result.installedState, methods),
      ports.getResolvedBinaryPath(result.pathExecutable.path),
    ])

    return {
      agent,
      ...result,
      latestVersion,
      methods,
      resolvedBinaryPath,
    }
  }

  return {
    observeRegisteredAgents(): Promise<ResolvedAgentObservation[]> {
      return Promise.all(ports.getAllAgents().map(observe))
    },
    async resolveAgentObservation(agentName: string): Promise<ResolvedAgentObservation | undefined> {
      const agent = ports.getAgentByNameOrAlias(agentName)
      return agent ? observe(agent) : undefined
    },
  }
}

export function resolveAgentObservation(
  agentName: string,
  context?: ProviderOperationContext,
): Promise<ResolvedAgentObservation | undefined> {
  if (context) return createProductionLifecycleObservationService(context).resolveAgentObservation(agentName)
  return withProductionObservationService(service => service.resolveAgentObservation(agentName))
}

export function observeRegisteredAgents(context?: ProviderOperationContext): Promise<ResolvedAgentObservation[]> {
  if (context) return createProductionLifecycleObservationService(context).observeRegisteredAgents()
  return withProductionObservationService(service => service.observeRegisteredAgents())
}

export function createProductionLifecycleObservationService(
  context: ProviderOperationContext,
  options: LifecycleObservationServiceOptions = {},
): LifecycleObservationService {
  return createLifecycleObservationService(
    {
      clock: () => new Date().toISOString(),
      getAllAgents: agentRegistry.getAllAgents,
      getAgentByNameOrAlias: agentRegistry.getAgentByNameOrAlias,
      getLatestVersion: (agent, installedState, methods) =>
        resolveLatestVersion(agent, installedState, methods, context),
      getOrderedInstallMethods,
      getPlatform,
      getResolvedBinaryPath: binaryPath => getResolvedBinaryPath(binaryPath, context),
      inspectExecutable: (agent, installedState) => inspectExecutable(agent, installedState, context),
      observeAgentLifecycle,
      providerRegistry: firstPartyProviderRegistry,
      readInstalledState: getInstalledAgentState,
      readReceipt: getLifecycleReceipt,
      signal: context.signal,
      timeoutMs: context.timeoutMs,
    },
    options,
  )
}

async function withProductionObservationService<T>(
  observe: (service: LifecycleObservationService) => Promise<T>,
): Promise<T> {
  const operation = createCliOperationContext()
  const service = createProductionLifecycleObservationService(operation.context)

  try {
    return await operation.run(() => observe(service))
  } finally {
    operation.dispose()
  }
}

async function inspectExecutable(
  agent: AgentDefinition,
  installedState: InstalledAgentState | undefined,
  context?: ProviderOperationContext,
): Promise<AgentExecutableObservation> {
  // One resolution decides presence and feeds the version probe, so an agent
  // outside the inherited PATH is probed through the path it actually occupies.
  const binaryPath = await resolveAgentExecutablePath(agent.binaryName, context)
  if (!binaryPath) return { present: false }

  const version = await getObservedInstalledVersion(agent, installedState, context, binaryPath)
  const path = (await getResolvedBinaryPath(binaryPath, context)) ?? binaryPath
  return { path, present: true, version }
}

async function getObservedInstalledVersion(
  agent: AgentDefinition,
  _installedState: InstalledAgentState | undefined,
  context?: ProviderOperationContext,
  executablePath?: string,
): Promise<string | undefined> {
  return probeInstalledVersion(agent.binaryName, agent.versionProbe, context, executablePath)
}

async function resolveLatestVersion(
  agent: AgentDefinition,
  installedState: InstalledAgentState | undefined,
  methods: InstallMethod[],
  context?: ProviderOperationContext,
): Promise<string | undefined> {
  const packageName = getLatestVersionPackage(agent, installedState, methods)
  return packageName ? getLatestVersion(packageName, 'latest', { context }) : undefined
}
