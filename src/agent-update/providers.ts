import type { ManagedInstallType } from '../agents/types'
import type { AgentUpdateContext, AgentUpdateProvider } from './types'
import { canUpdateInstallType, isManagedInstallType } from '../package-manager/capabilities'
import { canAutoUpdateAgent, canUpdateInstalledState } from '../utils/install'

function getManagedInstallerTypeFromContext(context: AgentUpdateContext): ManagedInstallType | undefined {
  if (context.installedState && isManagedInstallType(context.installedState.installType))
    return context.installedState.installType

  for (const method of context.methods) {
    if (isManagedInstallType(method.type) && canUpdateInstallType(method.type)) return method.type
  }

  return undefined
}

const managedAgentUpdateProvider: AgentUpdateProvider = {
  strategy: 'managed',
  canHandle: context => !!getManagedInstallerTypeFromContext(context),
  getManagedInstallerType: context => getManagedInstallerTypeFromContext(context),
}

const selfUpdatingAgentUpdateProvider: AgentUpdateProvider = {
  strategy: 'self-update',
  canHandle: context => !canUpdateInstalledState(context.installedState) && !!context.agent.selfUpdate,
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
