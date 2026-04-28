import { describe, expect, it } from 'vitest'
import {
  codex,
  copilot,
  createUpdatePlan,
  cursor,
  droid,
  gemini,
  getAgentByLookupName,
  getAgentByNameOrAlias,
  getAllAgents,
  inspectAgent,
  kilo,
  opencode,
  pi,
} from '../src/index'

describe('agent registry', () => {
  it('returns all agents', () => {
    const agents = getAllAgents()
    expect(agents.length).toBeGreaterThanOrEqual(9)
  })

  it('finds agent by name', () => {
    const agent = getAgentByNameOrAlias('claude')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('claude')
  })

  it('returns undefined for unknown agent', () => {
    const agent = getAgentByNameOrAlias('unknown-agent')
    expect(agent).toBeUndefined()
  })

  it('re-exports lookup-based resolution', () => {
    const agent = getAgentByLookupName('agent')
    expect(agent?.name).toBe('cursor')
  })

  it('resolves Kilo by published alias', () => {
    const agent = getAgentByLookupName('kilocode')
    expect(agent?.name).toBe('kilo')
  })
})

describe('agent definitions', () => {
  it('claude has correct structure', () => {
    const agent = getAgentByNameOrAlias('claude')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Claude Code')
    expect(agent!.packages?.npm).toBe('@anthropic-ai/claude-code')
    expect(agent!.binaryName).toBe('claude')
    expect(Object.keys(agent!.platforms).length).toBeGreaterThan(0)
  })

  it('codex has correct structure', () => {
    const agent = getAgentByNameOrAlias('codex')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Codex CLI')
    expect(agent!.packages?.npm).toBe('@openai/codex')
    expect(agent!.binaryName).toBe('codex')
  })

  it('opencode has correct structure', () => {
    const agent = getAgentByNameOrAlias('opencode')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('OpenCode')
    expect(agent!.packages?.npm).toBe('opencode-ai')
    expect(agent!.binaryName).toBe('opencode')
  })

  it('kilo has correct structure', () => {
    const agent = getAgentByNameOrAlias('kilo')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Kilo Code CLI')
    expect(agent!.packages?.npm).toBe('@kilocode/cli')
    expect(agent!.binaryName).toBe('kilo')
  })

  it('re-exports all built-in agents from root index', () => {
    expect(codex.name).toBe('codex')
    expect(copilot.name).toBe('copilot')
    expect(cursor.name).toBe('cursor')
    expect(droid.name).toBe('droid')
    expect(gemini.name).toBe('gemini')
    expect(kilo.name).toBe('kilo')
    expect(opencode.name).toBe('opencode')
    expect(pi.name).toBe('pi')
  })
})

describe('planning exports', () => {
  it('re-exports inspection and update planning helpers', async () => {
    const agent = getAgentByNameOrAlias('codex')
    expect(agent).toBeDefined()

    const inspection = await inspectAgent(agent!)
    const plan = createUpdatePlan([inspection])

    expect(inspection.agent.name).toBe('codex')
    expect(Array.isArray(plan.entries)).toBe(true)
  })
})
