import type { AgentDefinition } from './types'
import { amp } from './definitions/amp'
import { auggie } from './definitions/auggie'
import { autohand } from './definitions/autohand'
import { claude } from './definitions/claude'
import { codebuddy } from './definitions/codebuddy'
import { codex } from './definitions/codex'
import { copilot } from './definitions/copilot'
import { crush } from './definitions/crush'
import { cursor } from './definitions/cursor'
import { devin } from './definitions/devin'
import { droid } from './definitions/droid'
import { forgecode } from './definitions/forgecode'
import { gemini } from './definitions/gemini'
import { goose } from './definitions/goose'
import { junie } from './definitions/junie'
import { kilo } from './definitions/kilo'
import { kimi } from './definitions/kimi'
import { kiro } from './definitions/kiro'
import { opencode } from './definitions/opencode'
import { openhands } from './definitions/openhands'
import { pi } from './definitions/pi'
import { qoder } from './definitions/qoder'
import { qwen } from './definitions/qwen'
import { vibe } from './definitions/vibe'

const agents: AgentDefinition[] = [
  auggie,
  autohand,
  amp,
  claude,
  codebuddy,
  codex,
  copilot,
  crush,
  cursor,
  devin,
  droid,
  forgecode,
  gemini,
  goose,
  junie,
  kilo,
  kimi,
  kiro,
  openhands,
  opencode,
  pi,
  qoder,
  qwen,
  vibe,
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
  auggie,
  autohand,
  amp,
  claude,
  codebuddy,
  codex,
  copilot,
  crush,
  cursor,
  devin,
  droid,
  forgecode,
  gemini,
  goose,
  junie,
  kilo,
  kimi,
  kiro,
  openhands,
  opencode,
  pi,
  qoder,
  qwen,
  vibe,
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
