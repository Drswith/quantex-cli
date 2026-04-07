import type { AgentDefinition } from './types'
import { claudeCode } from './claude-code'
import { codex } from './codex'
import { copilot } from './copilot'
import { cursor } from './cursor'
import { droid } from './droid'
import { gemini } from './gemini'
import { opencode } from './opencode'
import { pi } from './pi'

const agents: AgentDefinition[] = [
  claudeCode,
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

export { claudeCode, codex, copilot, cursor, droid, gemini, opencode, pi }
export type { AgentDefinition, InstallMethod, Platform } from './types'
