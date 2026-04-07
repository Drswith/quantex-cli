import type { AgentDefinition } from '../src/agents/types'
import { describe, expect, it } from 'bun:test'
import { getAgentByNameOrAlias, getAllAgents } from '../src/agents'
import { claudeCode } from '../src/agents/claude-code'
import { codex } from '../src/agents/codex'
import { opencode } from '../src/agents/opencode'

describe('agent registry', () => {
  it('returns array with at least 3 agents', () => {
    const agents = getAllAgents()
    expect(agents.length).toBeGreaterThanOrEqual(3)
  })

  it('finds agent by name', () => {
    const agent = getAgentByNameOrAlias('claude-code')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('claude-code')
  })

  it('finds agent by alias', () => {
    const agent = getAgentByNameOrAlias('claude')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('claude-code')
  })

  it('returns undefined for unknown agent', () => {
    expect(getAgentByNameOrAlias('unknown-agent')).toBeUndefined()
  })
})

function validateAgent(agent: AgentDefinition): void {
  expect(agent.name).toBeTruthy()
  expect(agent.aliases).toBeInstanceOf(Array)
  expect(agent.displayName).toBeTruthy()
  expect(agent.description).toBeTruthy()
  expect(agent.package).toBeTruthy()
  expect(agent.binaryName).toBeTruthy()
  expect(agent.installMethods.length).toBeGreaterThan(0)

  for (const method of agent.installMethods) {
    expect(['bun', 'npm', 'binary']).toContain(method.type)
    expect(method.supportedPlatforms.length).toBeGreaterThan(0)
    expect(typeof method.priority).toBe('number')
    if (typeof method.command === 'string') {
      expect(method.command).toBeTruthy()
    }
    else {
      expect(typeof method.command).toBe('function')
    }
  }
}

describe('claude-code', () => {
  it('has valid structure', () => {
    validateAgent(claudeCode)
    expect(claudeCode.name).toBe('claude-code')
    expect(claudeCode.displayName).toBe('Claude Code')
    expect(claudeCode.package).toBe('@anthropic-ai/claude-code')
    expect(claudeCode.binaryName).toBe('claude')
    expect(claudeCode.aliases).toContain('claude')
  })

  it('binary command function returns correct strings per platform', () => {
    const binaryMethod = claudeCode.installMethods.find(m => m.type === 'binary')
    expect(binaryMethod).toBeDefined()
    const fn = binaryMethod!.command as (platform: 'windows' | 'macos' | 'linux') => string

    expect(fn('windows')).toContain('irm')
    expect(fn('macos')).toContain('brew')
    expect(fn('linux')).toContain('curl')
  })
})

describe('codex', () => {
  it('has valid structure', () => {
    validateAgent(codex)
    expect(codex.name).toBe('codex')
    expect(codex.displayName).toBe('Codex CLI')
    expect(codex.package).toBe('@openai/codex')
    expect(codex.binaryName).toBe('codex')
  })
})

describe('opencode', () => {
  it('has valid structure', () => {
    validateAgent(opencode)
    expect(opencode.name).toBe('opencode')
    expect(opencode.displayName).toBe('OpenCode')
    expect(opencode.package).toBe('opencode')
    expect(opencode.binaryName).toBe('opencode')
  })
})

describe('agent identifiers', () => {
  it('has no duplicate names or aliases across agents', () => {
    const agents = getAllAgents()
    const seen = new Map<string, string>()
    for (const agent of agents) {
      const identifiers = [agent.name, ...agent.aliases]
      for (const id of identifiers) {
        const existingAgent = seen.get(id)
        if (existingAgent && existingAgent !== agent.name) {
          throw new Error(`Duplicate identifier "${id}" in "${existingAgent}" and "${agent.name}"`)
        }
        seen.set(id, agent.name)
      }
    }
  })

  it('agent names are lowercase', () => {
    for (const agent of getAllAgents()) {
      expect(agent.name).toBe(agent.name.toLowerCase())
    }
  })

  it('displayNames are not all lowercase', () => {
    for (const agent of getAllAgents()) {
      expect(agent.displayName).not.toBe(agent.displayName.toLowerCase())
    }
  })
})
