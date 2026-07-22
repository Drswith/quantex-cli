import type { AgentDefinition, InstallMethod, Platform } from '../agents'
import type { ProviderId, ProviderTarget, ProviderTargetKind } from '../providers/types'
import type { InstalledAgentState } from '../state'
import type { LifecycleReceipt } from './model'
import { firstPartyProviderIds } from '../providers/types'

export interface LifecycleProviderBinding {
  readonly providerId: ProviderId
  readonly target: ProviderTarget
}

export interface CatalogProviderEvidence {
  readonly bindings: readonly LifecycleProviderBinding[]
  readonly unresolvedCandidates: readonly InstallMethod[]
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
      ...(state.binaryName || providerId === 'binary' || providerId === 'script' || providerId === 'deno'
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

export function resolveCatalogProviderBindings(
  agent: AgentDefinition,
  platform: Platform,
): readonly LifecycleProviderBinding[] {
  return resolveCatalogProviderEvidence(agent, platform).bindings
}

export function resolveInstallMethodProviderBinding(
  agent: AgentDefinition,
  method: InstallMethod,
): LifecycleProviderBinding | undefined {
  return resolveStateProviderBinding(agent, {
    agentName: agent.name,
    ...(method.binaryName ? { binaryName: method.binaryName } : {}),
    ...(method.command ? { command: method.command } : {}),
    installType: method.type,
    ...(method.packageInstallArgs ? { packageInstallArgs: method.packageInstallArgs } : {}),
    ...(method.packageName ? { packageName: method.packageName } : {}),
    ...(method.packageTargetKind ? { packageTargetKind: method.packageTargetKind } : {}),
  })
}

export function resolveCatalogProviderEvidence(agent: AgentDefinition, platform: Platform): CatalogProviderEvidence {
  const resolved = (agent.platforms[platform] ?? []).map(method => ({
    binding: resolveInstallMethodProviderBinding(agent, method),
    method,
  }))
  const bindings = resolved
    .map(candidate => candidate.binding)
    .filter((binding): binding is LifecycleProviderBinding => binding !== undefined)

  return {
    bindings: bindings.filter(
      (binding, index) =>
        bindings.findIndex(candidate => providerBindingsEqual(candidate, binding, agent.binaryName)) === index,
    ),
    unresolvedCandidates: resolved
      .filter(candidate => candidate.binding === undefined)
      .map(candidate => candidate.method),
  }
}

export function providerBindingsEqual(
  left: LifecycleProviderBinding,
  right: LifecycleProviderBinding,
  defaultExecutableName?: string,
): boolean {
  return (
    left.providerId === right.providerId &&
    left.target.id === right.target.id &&
    left.target.kind === right.target.kind &&
    (left.target.binaryName ?? defaultExecutableName) === (right.target.binaryName ?? defaultExecutableName)
  )
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
