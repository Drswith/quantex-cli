import type { AgentDefinition } from '../agents'
import type { AgentInspection } from '../inspection'
import * as agentRegistry from '../agents'
import * as inspectionService from '../inspection'

export interface ResolvedAgentInspection {
  agent: AgentDefinition
  inspection: AgentInspection
}

export function resolveAgent(agentName: string): AgentDefinition | undefined {
  return agentRegistry.getAgentByNameOrAlias(agentName)
}

// Mutation and execution consumers intentionally remain on the legacy inspection implementation.
export async function resolveAgentInspection(agentName: string): Promise<ResolvedAgentInspection | undefined> {
  const agent = resolveAgent(agentName)
  if (!agent) return undefined

  return {
    agent,
    inspection: await inspectionService.inspectAgent(agent),
  }
}

export async function inspectRegisteredAgents(): Promise<AgentInspection[]> {
  return inspectionService.inspectAllAgents(agentRegistry.getAllAgents())
}
