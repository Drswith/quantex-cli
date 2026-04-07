import { describe, expect, it } from 'vitest'
import { getAgentByNameOrAlias, getAllAgents } from '../src/index'

describe('agent registry', () => {
  it('returns all agents', () => {
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
    const agent = getAgentByNameOrAlias('unknown-agent')
    expect(agent).toBeUndefined()
  })
})

describe('agent definitions', () => {
  it('claude-code has correct structure', () => {
    const agent = getAgentByNameOrAlias('claude-code')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Claude Code')
    expect(agent!.package).toBe('@anthropic-ai/claude-code')
    expect(agent!.binaryName).toBe('claude')
    expect(agent!.aliases).toContain('claude')
    expect(agent!.installMethods.length).toBeGreaterThanOrEqual(2)
  })

  it('codex has correct structure', () => {
    const agent = getAgentByNameOrAlias('codex')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Codex CLI')
    expect(agent!.package).toBe('@openai/codex')
    expect(agent!.binaryName).toBe('codex')
  })

  it('opencode has correct structure', () => {
    const agent = getAgentByNameOrAlias('opencode')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('OpenCode')
    expect(agent!.package).toBe('opencode')
    expect(agent!.binaryName).toBe('opencode')
  })
})
