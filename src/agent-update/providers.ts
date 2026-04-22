import type { AgentUpdateContext, AgentUpdateProvider } from './types'
import { isManagedInstallType } from '../package-manager/capabilities'
import { canAutoUpdateAgent, canUpdateInstalledState } from '../utils/install'

const managedAgentUpdateProvider: AgentUpdateProvider = {
  strategy: 'managed',
  canHandle: context => canUpdateInstalledState(context.installedState),
  getManagedInstallerType: (context) => {
    if (context.installedState && isManagedInstallType(context.installedState.installType))
      return context.installedState.installType

    return undefined
  },
}

const selfUpdatingAgentUpdateProvider: AgentUpdateProvider = {
  strategy: 'self-update',
  canHandle: context => !canUpdateInstalledState(context.installedState) && !!context.agent.update?.commands.length,
}

const manualAgentUpdateProvider: AgentUpdateProvider = {
  strategy: 'manual-hint',
  canHandle: () => true,
}

const agentUpdateProviders: AgentUpdateProvider[] = [
  managedAgentUpdateProvider,
  selfUpdatingAgentUpdateProvider,
  manualAgentUpdateProvider,
]

export function resolveAgentUpdateProvider(context: AgentUpdateContext): AgentUpdateProvider {
  return agentUpdateProviders.find(provider => provider.canHandle(context)) ?? manualAgentUpdateProvider
}

export function getAgentUpdateStrategy(context: AgentUpdateContext): AgentUpdateProvider['strategy'] {
  return resolveAgentUpdateProvider(context).strategy
}

export function canResolveAgentUpdate(context: AgentUpdateContext): boolean {
  return canAutoUpdateAgent(context.agent, context.installedState)
}

export { agentUpdateProviders }
