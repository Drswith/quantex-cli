import type { AgentDefinition } from './types'
import { claudeCode } from './claude-code'
import { codex } from './codex'
import { opencode } from './opencode'

const agents: AgentDefinition[] = [claudeCode, codex, opencode]

export function getAllAgents(): AgentDefinition[] {
  return agents
}

export function getAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  return agents.find(a => a.name === name || a.aliases.includes(name))
}

export { claudeCode, codex, opencode }
export type { AgentDefinition, InstallMethod, Platform } from './types'
