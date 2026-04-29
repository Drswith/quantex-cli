import type { AgentDefinition } from './types'
import { claude } from './definitions/claude'
import { codex } from './definitions/codex'
import { copilot } from './definitions/copilot'
import { cursor } from './definitions/cursor'
import { droid } from './definitions/droid'
import { gemini } from './definitions/gemini'
import { kilo } from './definitions/kilo'
import { opencode } from './definitions/opencode'
import { pi } from './definitions/pi'
import { qoder } from './definitions/qoder'
import { qwen } from './definitions/qwen'

const agents: AgentDefinition[] = [claude, codex, copilot, cursor, droid, gemini, kilo, opencode, pi, qoder, qwen]

export function getAllAgents(): AgentDefinition[] {
  return agents
}

export function getAgentByLookupName(name: string): AgentDefinition | undefined {
  return agents.find(agent => agent.name === name || (agent.lookupAliases?.includes(name) ?? false))
}

export function getAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  return getAgentByLookupName(name)
}

export { claude, codex, copilot, cursor, droid, gemini, kilo, opencode, pi, qoder, qwen }
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
