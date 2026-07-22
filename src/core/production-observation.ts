import type { AgentDefinition, AgentVersionProbe, InstallMethod, Platform } from '../agents/types'
import type { AgentExecutableObservation, AgentLifecycleObservationResult } from '../lifecycle/agent-observation'
import type { ProviderRegistry } from '../providers/registry'
import type { ProviderOperationContext } from '../providers/types'
import type { VersionedQuantexState } from '../state/schema'
import type { CoreInvocationContext } from './invocation'
import { readFile, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { observeAgentLifecycle } from '../lifecycle/agent-observation'
import { resolveInstallMethodProviderBinding } from '../lifecycle/provider-binding'
import { createEmptyStateDocument, parseStateDocument, StateSchemaError } from '../state/schema'
import { getCoreAgentByNameOrAlias, getCoreAgents } from './agent-catalog'
import { createCoreProviderObservationRegistry } from './provider-observation-registry'
import { CoreProcessInterruptionError, runReadOnlyCommand } from './read-only-process'

export interface CoreAgentObservation extends AgentLifecycleObservationResult {
  readonly agent: AgentDefinition
  readonly methods: readonly InstallMethod[]
  readonly resolvedBinaryPath?: string
}

export interface CoreReadContext extends CoreInvocationContext {
  readonly configDir: string
}

export interface CoreReadPorts {
  inspectAgent(name: string, context: CoreReadContext): Promise<CoreAgentObservation | undefined>
  listAgents(context: CoreReadContext): Promise<readonly AgentDefinition[]>
}

export interface ProductionCoreReadOptions {
  readonly providerRegistry?: ProviderRegistry
}

export function resolveCoreConfigDir(configDir?: string): string {
  if (configDir !== undefined) return isAbsolute(configDir) ? configDir : resolve(configDir)
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), '.quantex')
}

export function createProductionCoreReadPorts(options: ProductionCoreReadOptions = {}): CoreReadPorts {
  const providerRegistry = options.providerRegistry ?? createCoreProviderObservationRegistry()
  return {
    async inspectAgent(name, context): Promise<CoreAgentObservation | undefined> {
      const agent = getCoreAgentByNameOrAlias(name)
      if (!agent) return undefined
      return observeProductionAgent(agent, context, providerRegistry)
    },
    async listAgents(context): Promise<readonly AgentDefinition[]> {
      throwIfAborted(context.signal)
      return getCoreAgents()
    },
  }
}

export async function loadCoreStateDocument(configDir: string): Promise<VersionedQuantexState> {
  const stateFilePath = join(configDir, 'state.json')
  let raw: string
  try {
    raw = await readFile(stateFilePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) return createEmptyStateDocument()
    throw error
  }

  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch (error) {
    throw new StateSchemaError(`state.json contains invalid JSON: ${errorReason(error)}`)
  }
  return parseStateDocument(value).document
}

async function observeProductionAgent(
  agent: AgentDefinition,
  context: CoreReadContext,
  providerRegistry: ProviderRegistry,
): Promise<CoreAgentObservation> {
  const [state, methods] = await Promise.all([
    loadCoreStateDocument(context.configDir),
    getOrderedMethods(agent, context.configDir, context.signal),
  ])
  const operationContext: ProviderOperationContext = {
    registerCleanup: context.registerCleanup,
    signal: context.signal,
    timeoutMs: context.timeoutMs,
  }
  const result = await observeAgentLifecycle(agent, {
    clock: () => new Date().toISOString(),
    inspectExecutable: () => inspectExecutable(agent, operationContext),
    platform: getPlatform(),
    preferredCatalogBinding: methods[0] ? resolveInstallMethodProviderBinding(agent, methods[0]) : undefined,
    providerRegistry,
    readInstalledState: async agentName => state.installedAgents[agentName],
    readReceipt: async agentName => state.lifecycleReceipts[agentName],
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    observeProvider: async binding => {
      const adapter = providerRegistry.get(binding.providerId)
      if (!adapter) {
        return {
          kind: 'unavailable',
          reason: `Provider ${binding.providerId} is not registered.`,
          retryable: false,
        }
      }
      return adapter.observe({ context: operationContext, target: binding.target })
    },
  })
  const resolvedBinaryPath = await resolveExecutablePath(result.pathExecutable.path, context.signal)

  return {
    agent,
    ...result,
    methods,
    ...(resolvedBinaryPath ? { resolvedBinaryPath } : {}),
  }
}

async function inspectExecutable(
  agent: AgentDefinition,
  context: ProviderOperationContext,
): Promise<AgentExecutableObservation> {
  const path = await findExecutable(agent.binaryName, context)
  if (!path) return { present: false }
  const version = await inspectVersion(agent, path, context)
  return {
    path,
    present: true,
    ...(version ? { version } : {}),
  }
}

async function findExecutable(binaryName: string, context: ProviderOperationContext): Promise<string | undefined> {
  try {
    const result = await runReadOnlyCommand([process.platform === 'win32' ? 'where' : 'which', binaryName], context)
    if (result.exitCode !== 0) return undefined
    return result.stdout.trim().split(/\r?\n/u)[0] || undefined
  } catch (error) {
    if (error instanceof CoreProcessInterruptionError) throw error
    return undefined
  }
}

async function inspectVersion(
  agent: AgentDefinition,
  executablePath: string,
  context: ProviderOperationContext,
): Promise<string | undefined> {
  const configured = agent.versionProbe?.command ?? [agent.binaryName, '--version']
  const command = configured[0] === agent.binaryName ? [executablePath, ...configured.slice(1)] : configured
  try {
    const result = await runReadOnlyCommand(command, context)
    if (result.exitCode !== 0) return undefined
    return parseVersionOutput(result.stdout, agent.versionProbe?.parser)
  } catch (error) {
    if (error instanceof CoreProcessInterruptionError) throw error
    return undefined
  }
}

async function resolveExecutablePath(path: string | undefined, signal: AbortSignal): Promise<string | undefined> {
  if (!path) return undefined
  throwIfAborted(signal)
  try {
    const resolved = await realpath(path)
    throwIfAborted(signal)
    return resolved
  } catch {
    if (signal.aborted) throw new CoreProcessInterruptionError(abortReason(signal))
    return path
  }
}

async function getOrderedMethods(
  agent: AgentDefinition,
  configDir: string,
  signal: AbortSignal,
): Promise<readonly InstallMethod[]> {
  const methods = agent.platforms[getPlatform()] ?? []
  const preferredType = await readPreferredInstallType(configDir, signal)
  return [
    ...methods.filter(method => method.type === preferredType),
    ...methods.filter(method => method.type !== preferredType),
  ]
}

async function readPreferredInstallType(configDir: string, signal: AbortSignal): Promise<'bun' | 'mise' | 'npm'> {
  throwIfAborted(signal)
  try {
    const raw = await readFile(join(configDir, 'config.json'), 'utf8')
    throwIfAborted(signal)
    const value = JSON.parse(raw) as unknown
    if (isPlainObject(value) && isPreferredInstallType(value.defaultPackageManager)) {
      return value.defaultPackageManager
    }
  } catch (error) {
    if (signal.aborted) throw new CoreProcessInterruptionError(abortReason(signal))
    if (error instanceof CoreProcessInterruptionError) throw error
  }
  return 'bun'
}

function parseVersionOutput(text: string, parser?: AgentVersionProbe['parser']): string | undefined {
  if (typeof parser === 'function') return parser(text)
  const firstLine = text.trim().split(/\r?\n/u)[0]
  if (!firstLine) return undefined
  return firstLine.match(/v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/iu)?.[1] ?? firstLine
}

function getPlatform(): Platform {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'macos'
  return 'linux'
}

function isPreferredInstallType(value: unknown): value is 'bun' | 'mise' | 'npm' {
  return value === 'bun' || value === 'mise' || value === 'npm'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingFileError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return error.code === 'ENOENT' || error.code === 'ENOTDIR'
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new CoreProcessInterruptionError(abortReason(signal))
}

function abortReason(signal: AbortSignal): string | undefined {
  if (signal.reason === undefined) return undefined
  return signal.reason instanceof Error ? signal.reason.message : String(signal.reason)
}

function errorReason(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}
