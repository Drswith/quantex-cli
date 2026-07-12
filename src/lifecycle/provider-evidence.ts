import type { AgentDefinition } from '../agents'
import type {
  ProviderId,
  ProviderObservation,
  ProviderOutcome,
  ProviderRegistry,
  ProviderTarget,
  ProviderTargetKind,
} from '../providers'
import type { InstalledAgentState } from '../state'
import type { LifecycleReceipt } from './model'
import { firstPartyProviderRegistry, firstPartyProviderIds } from '../providers'

export interface LifecycleProviderBinding {
  readonly providerId: ProviderId
  readonly target: ProviderTarget
}

export interface ObserveLifecycleProviderOptions {
  readonly registry?: ProviderRegistry
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export function resolveStateProviderBinding(
  agent: AgentDefinition,
  state: InstalledAgentState,
): LifecycleProviderBinding | undefined {
  const providerId = asProviderId(state.installType)
  if (!providerId) return undefined
  const targetId = resolveStateTargetId(agent, state)
  if (!targetId) return undefined

  return {
    providerId,
    target: {
      ...(state.packageInstallArgs?.length ? { arguments: state.packageInstallArgs } : {}),
      ...(state.binaryName || providerId === 'binary' || providerId === 'script'
        ? { binaryName: state.binaryName ?? agent.binaryName }
        : {}),
      id: targetId,
      kind: targetKind(providerId, state.packageTargetKind),
    },
  }
}

export function resolveReceiptProviderBinding(receipt: LifecycleReceipt): LifecycleProviderBinding | undefined {
  const providerId = asProviderId(receipt.providerId)
  if (!providerId || receipt.providerTargetId.length === 0) return undefined
  if (providerId === 'brew' && receipt.providerTargetKind !== 'cask' && receipt.providerTargetKind !== 'formula') {
    return undefined
  }
  return {
    providerId,
    target: {
      ...(receipt.executableName ? { binaryName: receipt.executableName } : {}),
      id: receipt.providerTargetId,
      kind: receipt.providerTargetKind ?? targetKind(providerId),
    },
  }
}

export async function observeLifecycleProvider(
  binding: LifecycleProviderBinding,
  options: ObserveLifecycleProviderOptions,
): Promise<ProviderOutcome<ProviderObservation>> {
  const registry = options.registry ?? firstPartyProviderRegistry
  const adapter = registry.get(binding.providerId)
  if (!adapter) {
    return {
      kind: 'unavailable',
      reason: `Provider ${binding.providerId} is not registered.`,
      retryable: false,
    }
  }

  return adapter.observe({
    context: {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
    target: binding.target,
  })
}

function resolveStateTargetId(agent: AgentDefinition, state: InstalledAgentState): string | undefined {
  if (state.packageName) return state.packageName
  if (state.command) return state.command
  if (state.binaryName) return state.binaryName

  switch (state.installType) {
    case 'bun':
    case 'npm':
      return agent.packages?.npm
    case 'cargo':
      return agent.packages?.cargo
    case 'deno':
      return agent.packages?.deno
    case 'mise':
      return agent.packages?.mise
    case 'pip':
      return agent.packages?.pip
    case 'uv':
      return agent.packages?.uv
    case 'binary':
    case 'script':
      return agent.binaryName
    case 'brew':
    case 'winget':
      return undefined
  }
}

function targetKind(
  providerId: ProviderId,
  packageTargetKind?: InstalledAgentState['packageTargetKind'],
): ProviderTargetKind {
  switch (providerId) {
    case 'binary':
      return 'binary'
    case 'brew':
      return packageTargetKind === 'cask' ? 'cask' : 'formula'
    case 'deno':
    case 'mise':
    case 'uv':
      return 'tool'
    case 'script':
      return 'script'
    case 'winget':
      return 'id'
    case 'bun':
    case 'cargo':
    case 'npm':
    case 'pip':
      return 'package'
  }
}

function asProviderId(value: string): ProviderId | undefined {
  return firstPartyProviderIds.includes(value as ProviderId) ? (value as ProviderId) : undefined
}
