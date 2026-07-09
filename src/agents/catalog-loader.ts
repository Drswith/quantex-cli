import type { AgentDefinition, AgentVersionProbe } from './types'
import { agentCatalogSchema } from './schema'

export interface AgentBehaviorExtension {
  versionProbeParser?: AgentVersionProbe['parser']
}

export type AgentBehaviorExtensions = Partial<Record<string, AgentBehaviorExtension>>

export interface LoadedAgentCatalog {
  agents: AgentDefinition[]
  getAgent: (name: string) => AgentDefinition
}

export function loadAgentCatalog(data: unknown, behaviorExtensions: AgentBehaviorExtensions = {}): LoadedAgentCatalog {
  const parsedCatalog = agentCatalogSchema.parse(data)
  const agents = parsedCatalog.map(entry => toAgentDefinition(entry, behaviorExtensions[entry.name]))
  const agentsByName = new Map(agents.map(agent => [agent.name, agent]))

  return {
    agents,
    getAgent(name) {
      const agent = agentsByName.get(name)
      if (!agent) throw new Error(`Unknown catalog agent: ${name}`)
      return agent
    },
  }
}

function toAgentDefinition(
  entry: ReturnType<typeof agentCatalogSchema.parse>[number],
  behavior: AgentBehaviorExtension | undefined,
): AgentDefinition {
  return {
    ...entry,
    versionProbe: mergeVersionProbe(entry.versionProbe, behavior),
  }
}

function mergeVersionProbe(
  versionProbe: AgentDefinition['versionProbe'],
  behavior: AgentBehaviorExtension | undefined,
): AgentDefinition['versionProbe'] {
  if (!versionProbe && !behavior?.versionProbeParser) return undefined

  return {
    ...versionProbe,
    ...(behavior?.versionProbeParser ? { parser: behavior.versionProbeParser } : {}),
  }
}
