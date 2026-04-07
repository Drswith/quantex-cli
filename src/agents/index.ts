import type { AgentDefinition } from './types'
import { claudeCode } from './claude-code'
import { codex } from './codex'
import { droid } from './droid'
import { geminiCli } from './gemini-cli'
import { githubCopilotCli } from './github-copilot-cli'
import { opencode } from './opencode'
import { pi } from './pi'

const agents: AgentDefinition[] = [
  claudeCode,
  codex,
  droid,
  geminiCli,
  githubCopilotCli,
  opencode,
  pi,
]

export function getAllAgents(): AgentDefinition[] {
  return agents
}

export function getAgentByNameOrAlias(name: string): AgentDefinition | undefined {
  return agents.find(a => a.name === name || a.aliases.includes(name))
}

export { claudeCode, codex, droid, geminiCli, githubCopilotCli, opencode, pi }
export type { AgentDefinition, InstallMethod, Platform } from './types'
