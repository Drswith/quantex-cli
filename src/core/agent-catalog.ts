import type { AgentDefinition } from '../agents/types'
import { coreAgentCatalog } from './generated/agent-catalog'

export function getCoreAgents(): readonly AgentDefinition[] {
  return coreAgentCatalog
}

export function getCoreAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  const direct = coreAgentCatalog.find(agent => agent.name === name || agent.lookupAliases?.includes(name))
  if (direct) return direct
  const normalized = normalizeDisplayName(name)
  return coreAgentCatalog.find(agent => normalizeDisplayName(agent.displayName) === normalized)
}

function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase()
}
