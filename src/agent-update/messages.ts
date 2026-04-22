import type { AgentDefinition } from '../agents'
import type { AgentUpdateStrategy } from './types'

export function getManualAgentUpdateMessage(agent: Pick<AgentDefinition, 'displayName'>): string {
  return `${agent.displayName} uses a manually managed install source. Please check for updates manually.`
}

export function getAgentUpdateFailureHint(
  agent: Pick<AgentDefinition, 'displayName' | 'homepage' | 'selfUpdate'>,
  strategy: AgentUpdateStrategy,
): string | undefined {
  if (strategy === 'self-update' && agent.selfUpdate)
    return `Try running ${agent.selfUpdate.command.join(' ')} directly.`

  if (strategy === 'manual-hint')
    return `Check ${agent.homepage} for the recommended update path.`

  return undefined
}
