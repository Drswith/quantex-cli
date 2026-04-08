import type { AgentDefinition } from './types'
import { claude } from './claude'
import { codex } from './codex'
import { copilot } from './copilot'
import { cursor } from './cursor'
import { droid } from './droid'
import { gemini } from './gemini'
import { opencode } from './opencode'
import { pi } from './pi'

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
export type { AgentDefinition, InstallMethod, InstallType, ManagedInstallType, PackageTargetKind, Platform } from './types'
