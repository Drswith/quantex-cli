import { describe, expect, it } from 'vitest'
import {
  autohand,
  codebuddy,
  codex,
  copilot,
  createUpdatePlan,
  cursor,
  droid,
  gemini,
  getAgentByLookupName,
  getAgentByNameOrAlias,
  getAllAgents,
  junie,
  inspectAgent,
  kilo,
  openhands,
  opencode,
  pi,
  qoder,
} from '../src/index'

describe('agent registry', () => {
  it('returns all agents', () => {
    const agents = getAllAgents()
    expect(agents.length).toBeGreaterThanOrEqual(9)
  })

  it('finds auggie by name', () => {
    const agent = getAgentByNameOrAlias('auggie')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('auggie')
    expect(agent!.binaryName).toBe('auggie')
  })

  it('finds autohand by name', () => {
    const agent = getAgentByNameOrAlias('autohand')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('autohand')
    expect(agent!.binaryName).toBe('autohand')
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

  it('resolves Mistral Vibe by package alias', () => {
    const agent = getAgentByLookupName('mistral-vibe')
    expect(agent?.name).toBe('vibe')
  })

  it('finds OpenHands by name', () => {
    const agent = getAgentByNameOrAlias('openhands')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('openhands')
    expect(agent!.binaryName).toBe('openhands')
  })

  it('resolves CodeBuddy by package-style alias', () => {
    const agent = getAgentByLookupName('codebuddy-code')
    expect(agent?.name).toBe('codebuddy')
  })

  it('resolves Autohand by package-style alias', () => {
    const agent = getAgentByLookupName('autohand-cli')
    expect(agent?.name).toBe('autohand')
  })

  it('resolves Qoder by executable alias', () => {
    const agent = getAgentByLookupName('qodercli')
    expect(agent?.name).toBe('qoder')
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

  it('codebuddy has correct structure', () => {
    const agent = getAgentByNameOrAlias('codebuddy')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('CodeBuddy Code')
    expect(agent!.packages?.npm).toBe('@tencent-ai/codebuddy-code')
    expect(agent!.binaryName).toBe('codebuddy')
  })

  it('autohand has correct structure', () => {
    const agent = getAgentByNameOrAlias('autohand')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Autohand Code CLI')
    expect(agent!.packages?.npm).toBe('autohand-cli')
    expect(agent!.binaryName).toBe('autohand')
  })

  it('opencode has correct structure', () => {
    const agent = getAgentByNameOrAlias('opencode')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('OpenCode')
    expect(agent!.packages?.npm).toBe('opencode-ai')
    expect(agent!.binaryName).toBe('opencode')
  })

  it('openhands has correct structure', () => {
    const agent = getAgentByNameOrAlias('openhands')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('OpenHands CLI')
    expect(agent!.binaryName).toBe('openhands')
    expect(agent!.homepage).toBe('https://docs.openhands.dev/openhands/usage/cli/installation')
  })

  it('kilo has correct structure', () => {
    const agent = getAgentByNameOrAlias('kilo')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Kilo CLI')
    expect(agent!.packages?.npm).toBe('@kilocode/cli')
    expect(agent!.binaryName).toBe('kilo')
  })

  it('junie has correct structure', () => {
    const agent = getAgentByNameOrAlias('junie')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Junie CLI')
    expect(agent!.packages?.npm).toBe('@jetbrains/junie')
    expect(agent!.binaryName).toBe('junie')
  })

  it('qoder has correct structure', () => {
    const agent = getAgentByNameOrAlias('qoder')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Qoder CLI')
    expect(agent!.packages?.npm).toBe('@qoder-ai/qodercli')
    expect(agent!.binaryName).toBe('qodercli')
  })

  it('re-exports all built-in agents from root index', () => {
    expect(autohand.name).toBe('autohand')
    expect(codebuddy.name).toBe('codebuddy')
    expect(codex.name).toBe('codex')
    expect(copilot.name).toBe('copilot')
    expect(cursor.name).toBe('cursor')
    expect(droid.name).toBe('droid')
    expect(gemini.name).toBe('gemini')
    expect(junie.name).toBe('junie')
    expect(kilo.name).toBe('kilo')
    expect(openhands.name).toBe('openhands')
    expect(opencode.name).toBe('opencode')
    expect(pi.name).toBe('pi')
    expect(qoder.name).toBe('qoder')
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
