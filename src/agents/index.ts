// KEEP (S1): catalog lookup barrel. getAllAgents / getAgentByLookupName add
// alias and display-name matching; getAgentByNameOrAlias is the published v1
// name for that lookup. Generated catalog + withdrawn named exports stay for
// the frozen root surface. Not a leftover pass-through.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
import type { AgentDefinition } from './types'
import { getCatalogAgents } from './catalog'

const agents = getCatalogAgents()

export function getAllAgents(): AgentDefinition[] {
  return agents
}

export function getAgentByLookupName(name: string): AgentDefinition | undefined {
  const directMatch = agents.find(agent => agent.name === name || (agent.lookupAliases?.includes(name) ?? false))
  if (directMatch) return directMatch

  const normalizedDisplayName = normalizeDisplayName(name)
  return agents.find(agent => normalizeDisplayName(agent.displayName) === normalizedDisplayName)
}

export function getAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  return getAgentByLookupName(name)
}

export {
  antigravity,
  auggie,
  autohand,
  amp,
  claude,
  codebuddy,
  codewhale,
  codex,
  commandcode,
  copilot,
  crush,
  cursor,
  devin,
  droid,
  dsh,
  gemini,
  goose,
  grok,
  hermes,
  junie,
  kilo,
  kimi,
  kiro,
  mimo,
  omp,
  openclaw,
  openhands,
  opencode,
  pi,
  qoder,
  qwen,
  reasonix,
  vibe,
} from './generated/catalog-agents'
export { agentCatalogJsonSchema, getCatalogAgent, getCatalogAgents } from './catalog'
// Withdrawn from the catalog, retained as v1 root exports only. Not catalog members.
export { deepcode, genie, jcode, vtcode } from './withdrawn'
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

function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase()
}
