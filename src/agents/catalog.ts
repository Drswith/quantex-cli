import type { AgentDefinition } from './types'
import { loadAgentCatalog } from './catalog-loader'
import { catalogData } from './generated/catalog-data'

export { agentCatalogJsonSchema } from './schema'
export type { AgentCatalogData, AgentCatalogEntry } from './schema'

const loadedCatalog = loadAgentCatalog(catalogData)

export function getCatalogAgents(): AgentDefinition[] {
  return loadedCatalog.agents
}

export function getCatalogAgent(name: string): AgentDefinition {
  return loadedCatalog.getAgent(name)
}
