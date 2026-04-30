import type { AgentDefinition } from './types'
import { amp } from './definitions/amp'
import { claude } from './definitions/claude'
import { codex } from './definitions/codex'
import { copilot } from './definitions/copilot'
import { crush } from './definitions/crush'
import { cursor } from './definitions/cursor'
import { droid } from './definitions/droid'
import { forgecode } from './definitions/forgecode'
import { gemini } from './definitions/gemini'
import { goose } from './definitions/goose'
import { kilo } from './definitions/kilo'
import { kimi } from './definitions/kimi'
import { kiro } from './definitions/kiro'
import { opencode } from './definitions/opencode'
import { pi } from './definitions/pi'
import { qoder } from './definitions/qoder'
import { qwen } from './definitions/qwen'

const agents: AgentDefinition[] = [
  amp,
  claude,
  codex,
  copilot,
  crush,
  cursor,
  droid,
  forgecode,
  gemini,
  goose,
  kimi,
  kilo,
  kiro,
  opencode,
  pi,
  qoder,
  qwen,
]

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
  amp,
  claude,
  codex,
  copilot,
  crush,
  cursor,
  droid,
  forgecode,
  gemini,
  goose,
  kimi,
  kilo,
  kiro,
  opencode,
  pi,
  qoder,
  qwen,
}
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
