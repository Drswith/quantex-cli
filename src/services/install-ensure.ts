import type { AgentDefinition } from '../agents'
import type { InstalledAgentState } from '../state'
import type { ResourceLockError } from '../utils/lock'
import { installAgent, trackInstalledAgent } from '../package-manager'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { isResourceLockError } from '../utils/lock'
import { resolveAgentInspection } from './agents'

export interface InstallEnsureLifecycleDependencies {
  getAdoptableExistingInstallMethod: typeof getAdoptableExistingInstallMethod
  installAgent: typeof installAgent
  isResourceLockError: typeof isResourceLockError
  resolveAgentInspection: typeof resolveAgentInspection
  trackInstalledAgent: typeof trackInstalledAgent
}

export interface InstallEnsureLifecycleOptions {
  dryRun: boolean
  onMutationStart?: (agent: AgentDefinition) => void
}

type ResolvedLifecycleOutcome =
  | {
      agent: AgentDefinition
      kind: 'already-installed' | 'install-failed' | 'tracking-cancelled' | 'untracked-existing'
    }
  | {
      agent: AgentDefinition
      kind: 'would-install' | 'would-track-existing'
    }
  | {
      agent: AgentDefinition
      installedState: InstalledAgentState
      kind: 'tracked-existing'
    }
  | {
      agent: AgentDefinition
      installedState?: InstalledAgentState
      kind: 'installed'
    }
  | {
      agent: AgentDefinition
      error: ResourceLockError
      installed: boolean
      kind: 'resource-locked'
    }

export type InstallEnsureLifecycleOutcome =
  | {
      input: string
      kind: 'agent-not-found'
    }
  | ResolvedLifecycleOutcome

function createDefaultDependencies(): InstallEnsureLifecycleDependencies {
  return {
    getAdoptableExistingInstallMethod,
    installAgent,
    isResourceLockError,
    resolveAgentInspection,
    trackInstalledAgent,
  }
}

export async function runInstallEnsureLifecycle(
  agentName: string,
  options: InstallEnsureLifecycleOptions,
  dependencies: InstallEnsureLifecycleDependencies = createDefaultDependencies(),
): Promise<InstallEnsureLifecycleOutcome> {
  const resolved = await dependencies.resolveAgentInspection(agentName)
  if (!resolved) {
    return {
      input: agentName,
      kind: 'agent-not-found',
    }
  }

  const { agent, inspection } = resolved
  if (inspection.inPath) {
    if (inspection.installedState) {
      return {
        agent,
        kind: 'already-installed',
      }
    }

    const adoptableMethod = dependencies.getAdoptableExistingInstallMethod(
      inspection.methods,
      inspection.resolvedBinaryPath ?? inspection.binaryPath,
    )
    if (!adoptableMethod) {
      return {
        agent,
        kind: 'untracked-existing',
      }
    }

    if (options.dryRun) {
      return {
        agent,
        kind: 'would-track-existing',
      }
    }

    options.onMutationStart?.(agent)

    try {
      const installedState = await dependencies.trackInstalledAgent(agent, adoptableMethod)
      if (!installedState) {
        return {
          agent,
          kind: 'tracking-cancelled',
        }
      }

      return {
        agent,
        installedState,
        kind: 'tracked-existing',
      }
    } catch (error) {
      if (dependencies.isResourceLockError(error)) {
        return {
          agent,
          error,
          installed: true,
          kind: 'resource-locked',
        }
      }

      throw error
    }
  }

  if (options.dryRun) {
    return {
      agent,
      kind: 'would-install',
    }
  }

  options.onMutationStart?.(agent)

  try {
    const result = await dependencies.installAgent(agent)
    if (!result.success) {
      return {
        agent,
        kind: 'install-failed',
      }
    }

    return {
      agent,
      installedState: result.installedState,
      kind: 'installed',
    }
  } catch (error) {
    if (dependencies.isResourceLockError(error)) {
      return {
        agent,
        error,
        installed: false,
        kind: 'resource-locked',
      }
    }

    throw error
  }
}
