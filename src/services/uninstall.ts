import type { AgentDefinition } from '../agents'
import type { ResourceLockError } from '../utils/lock'
import { uninstallAgent } from '../package-manager'
import { getInstalledAgentState } from '../state'
import { isResourceLockError } from '../utils/lock'
import { resolveAgent } from './agents'

export interface UninstallLifecycleDependencies {
  getInstalledAgentState: typeof getInstalledAgentState
  isResourceLockError: typeof isResourceLockError
  resolveAgent: typeof resolveAgent
  uninstallAgent: typeof uninstallAgent
}

export interface UninstallLifecycleOptions {
  dryRun: boolean
}

type ResolvedUninstallOutcome =
  | {
      agent: AgentDefinition
      kind: 'uninstall-failed' | 'uninstalled' | 'would-uninstall'
    }
  | {
      agent: AgentDefinition
      input: string
      kind: 'unmanaged'
    }
  | {
      agent: AgentDefinition
      error: ResourceLockError
      kind: 'resource-locked'
    }

export type UninstallLifecycleOutcome =
  | {
      input: string
      kind: 'agent-not-found'
    }
  | ResolvedUninstallOutcome

function createDefaultDependencies(): UninstallLifecycleDependencies {
  return {
    getInstalledAgentState,
    isResourceLockError,
    resolveAgent,
    uninstallAgent,
  }
}

export async function runUninstallLifecycle(
  agentName: string,
  options: UninstallLifecycleOptions,
  dependencies: UninstallLifecycleDependencies = createDefaultDependencies(),
): Promise<UninstallLifecycleOutcome> {
  const agent = dependencies.resolveAgent(agentName)
  if (!agent) {
    return {
      input: agentName,
      kind: 'agent-not-found',
    }
  }

  const installedState = await dependencies.getInstalledAgentState(agent.name)
  if (!installedState) {
    return {
      agent,
      input: agentName,
      kind: 'unmanaged',
    }
  }

  if (options.dryRun) {
    return {
      agent,
      kind: 'would-uninstall',
    }
  }

  try {
    const success = await dependencies.uninstallAgent(agent)
    return {
      agent,
      kind: success ? 'uninstalled' : 'uninstall-failed',
    }
  } catch (error) {
    if (dependencies.isResourceLockError(error)) {
      return {
        agent,
        error,
        kind: 'resource-locked',
      }
    }

    throw error
  }
}
