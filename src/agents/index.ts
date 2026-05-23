import type { AgentDefinition } from './types'
import { getCatalogAgents } from './catalog'

const agents = getCatalogAgents()

export function getAllAgents(): AgentDefinition[] {
  return agents
}

export function getAgentByLookupName(name: string): AgentDefinition | undefined {
  return agents.find(agent => agent.name === name || (agent.lookupAliases?.includes(name) ?? false))
}

export function getAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  return getAgentByLookupName(name)
}

export {
  auggie,
  autohand,
  amp,
  claude,
  codebuddy,
  codex,
  copilot,
  crush,
  cursor,
  deepseek,
  devin,
  droid,
  forgecode,
  gemini,
  genie,
  goose,
  jcode,
  junie,
  kilo,
  kimi,
  kiro,
  openhands,
  opencode,
  pi,
  qoder,
  qwen,
  reasonix,
  vibe,
  vtcode,
} from './generated/catalog-agents'
export { agentCatalogJsonSchema, getCatalogAgent, getCatalogAgents } from './catalog'
export { agentCatalogEntrySchema, agentCatalogSchema } from './schema'
export type { AgentCatalogData, AgentCatalogEntry } from './schema'
export type {
  AgentDefinition,
  AgentPackageMetadata,
  AgentSelfUpdate,
  AgentVersionProbe,
  BinaryInstallMethod,
  InstallMethod,
  InstallType,
  ManagedInstallMethod,
  ManagedInstallType,
  PackageTargetKind,
  Platform,
  ScriptInstallMethod,
} from './types'
