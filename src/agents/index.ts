import type { AgentDefinition } from './types'
import { claude } from './definitions/claude'
import { codex } from './definitions/codex'
import { copilot } from './definitions/copilot'
import { crush } from './definitions/crush'
import { cursor } from './definitions/cursor'
import { droid } from './definitions/droid'
import { gemini } from './definitions/gemini'
import { goose } from './definitions/goose'
import { kilo } from './definitions/kilo'
import { kimi } from './definitions/kimi'
import { opencode } from './definitions/opencode'
import { pi } from './definitions/pi'
import { qoder } from './definitions/qoder'
import { qwen } from './definitions/qwen'

const agents: AgentDefinition[] = [
  claude,
  codex,
  copilot,
  crush,
  cursor,
  droid,
  gemini,
  goose,
  kimi,
  kilo,
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

export { claude, codex, copilot, crush, cursor, droid, gemini, goose, kimi, kilo, opencode, pi, qoder, qwen }
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
