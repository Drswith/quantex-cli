import type { AgentDefinition } from './types'
import { claude } from './definitions/claude'
import { codex } from './definitions/codex'
import { copilot } from './definitions/copilot'
import { cursor } from './definitions/cursor'
import { droid } from './definitions/droid'
import { gemini } from './definitions/gemini'
import { opencode } from './definitions/opencode'
import { pi } from './definitions/pi'

const agents: AgentDefinition[] = [
  claude,
  codex,
  copilot,
  cursor,
  droid,
  gemini,
  opencode,
  pi,
]

export function getAllAgents(): AgentDefinition[] {
  return agents
}

export function getAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  return agents.find(a => a.name === name || a.aliases.includes(name))
}

export { claude, codex, copilot, cursor, droid, gemini, opencode, pi }
export type {
  AgentDefinition,
  AgentPackageMetadata,
  BinaryInstallMethod,
  InstallMethod,
  InstallType,
  ManagedInstallMethod,
  ManagedInstallType,
  PackageTargetKind,
  Platform,
  ScriptInstallMethod,
} from './types'
