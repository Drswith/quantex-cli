import type { AgentDefinition } from '../agents'
import type { AgentUpdateStrategy } from './types'

export function getManualAgentUpdateMessage(agent: Pick<AgentDefinition, 'displayName'>): string {
  return `${agent.displayName} uses a manually managed install source. Please check for updates manually.`
}

export function getUntrackedPathAgentUpdateMessage(agent: Pick<AgentDefinition, 'displayName' | 'name'>): string {
  return `${agent.displayName} is detected in PATH but not tracked as a Quantex-managed install. Use \`quantex inspect ${agent.name} --json\` to confirm the source, then reinstall through Quantex if you want \`quantex update --all\` to manage it.`
}

export function getAgentUpdateFailureHint(
  agent: Pick<AgentDefinition, 'displayName' | 'homepage' | 'selfUpdate'>,
  strategy: AgentUpdateStrategy,
): string | undefined {
  if (strategy === 'self-update' && agent.selfUpdate)
    return `Try running ${agent.selfUpdate.command.join(' ')} directly.`

  if (strategy === 'manual-hint') return `Check ${agent.homepage} for the recommended update path.`

  return undefined
}
