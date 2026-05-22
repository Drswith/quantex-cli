import type { AgentDefinition, AgentVersionProbe } from './types'
import { catalogData } from './generated/catalog-data'
import { agentCatalogSchema } from './schema'

export { agentCatalogJsonSchema } from './schema'
export type { AgentCatalogData, AgentCatalogEntry } from './schema'

interface AgentBehaviorExtension {
  versionProbeParser?: AgentVersionProbe['parser']
}

const behaviorExtensions: Partial<Record<string, AgentBehaviorExtension>> = {}

const parsedCatalog = agentCatalogSchema.parse(catalogData)
const agents = parsedCatalog.map(toAgentDefinition)
const agentsByName = new Map(agents.map(agent => [agent.name, agent]))

export function getCatalogAgents(): AgentDefinition[] {
  return agents
}

export function getCatalogAgent(name: string): AgentDefinition {
  const agent = agentsByName.get(name)
  if (!agent) throw new Error(`Unknown catalog agent: ${name}`)
  return agent
}

function toAgentDefinition(entry: (typeof parsedCatalog)[number]): AgentDefinition {
  const behavior = behaviorExtensions[entry.name]
  const versionProbe = mergeVersionProbe(entry.versionProbe, behavior)

  return {
    ...entry,
    versionProbe,
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
