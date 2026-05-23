import { describe, expect, it } from 'vitest'
import {
  autohand,
  codebuddy,
  codex,
  copilot,
  createUpdatePlan,
  deepseek,
  cursor,
  devin,
  droid,
  gemini,
  genie,
  jcode,
  getAgentByLookupName,
  getAgentByNameOrAlias,
  getAllAgents,
  junie,
  inspectAgent,
  kilo,
  omp,
  openhands,
  opencode,
  pi,
  qoder,
  reasonix,
  vtcode,
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

  it('finds omp by name', () => {
    const agent = getAgentByNameOrAlias('omp')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('omp')
    expect(agent!.binaryName).toBe('omp')
  })

  it('finds jcode by name', () => {
    const agent = getAgentByNameOrAlias('jcode')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('jcode')
    expect(agent!.binaryName).toBe('jcode')
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

  it('resolves Reasonix by repository-style alias', () => {
    const agent = getAgentByLookupName('deepseek-reasonix')
    expect(agent?.name).toBe('reasonix')
  })

  it('finds VTCode by name', () => {
    const agent = getAgentByNameOrAlias('vtcode')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('vtcode')
    expect(agent!.binaryName).toBe('vtcode')
  })

  it('finds Genie by name', () => {
    const agent = getAgentByNameOrAlias('genie')
    expect(agent).toBeDefined()
    expect(agent!.name).toBe('genie')
    expect(agent!.binaryName).toBe('genie')
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

  it('devin has correct structure', () => {
    const agent = getAgentByNameOrAlias('devin')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Devin for Terminal')
    expect(agent!.binaryName).toBe('devin')
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

  it('genie has correct Deno-managed structure', () => {
    const agent = getAgentByNameOrAlias('genie')
    expect(agent).toBe(genie)
    expect(agent!.displayName).toBe('Genie')
    expect(agent!.packages?.deno).toBe('jsr:@nicorio/genie')
    expect(agent!.platforms.linux!.find(method => method.type === 'deno')).toBeDefined()
  })

  it('kilo has correct structure', () => {
    const agent = getAgentByNameOrAlias('kilo')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Kilo CLI')
    expect(agent!.packages?.npm).toBe('@kilocode/cli')
    expect(agent!.binaryName).toBe('kilo')
  })

  it('omp has correct structure', () => {
    const agent = getAgentByNameOrAlias('omp')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('oh-my-pi (OMP)')
    expect(agent!.packages?.npm).toBe('@oh-my-pi/pi-coding-agent')
    expect(agent!.binaryName).toBe('omp')
    expect(agent!.homepage).toBe('https://github.com/can1357/oh-my-pi')
    expect(agent!.versionProbe?.command).toEqual(['omp', '--version'])
  })

  it('junie has correct structure', () => {
    const agent = getAgentByNameOrAlias('junie')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Junie CLI')
    expect(agent!.packages?.npm).toBe('@jetbrains/junie')
    expect(agent!.binaryName).toBe('junie')
  })

  it('jcode has correct structure', () => {
    const agent = getAgentByNameOrAlias('jcode')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('JCode')
    expect(agent!.binaryName).toBe('jcode')
    expect(agent!.homepage).toBe('https://github.com/1jehuang/jcode')
    expect(agent!.selfUpdate).toBeUndefined()
  })

  it('deepseek has correct structure', () => {
    const agent = getAgentByNameOrAlias('deepseek')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('DeepSeek TUI')
    expect(agent!.packages?.npm).toBe('deepseek-tui')
    expect(agent!.binaryName).toBe('deepseek')
  })

  it('qoder has correct structure', () => {
    const agent = getAgentByNameOrAlias('qoder')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Qoder CLI')
    expect(agent!.packages?.npm).toBe('@qoder-ai/qodercli')
    expect(agent!.binaryName).toBe('qodercli')
  })

  it('reasonix has correct structure', () => {
    const agent = getAgentByNameOrAlias('reasonix')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('Reasonix')
    expect(agent!.packages?.npm).toBe('reasonix')
    expect(agent!.binaryName).toBe('reasonix')
    expect(agent!.homepage).toBe('https://github.com/esengine/DeepSeek-Reasonix')
  })

  it('vtcode has correct structure', () => {
    const agent = getAgentByNameOrAlias('vtcode')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('VTCode')
    expect(agent!.packages?.cargo).toBe('vtcode')
    expect(agent!.binaryName).toBe('vtcode')
    expect(agent!.homepage).toBe('https://github.com/vinhnx/vtcode')
  })

  it('re-exports all built-in agents from root index', () => {
    expect(autohand.name).toBe('autohand')
    expect(codebuddy.name).toBe('codebuddy')
    expect(codex.name).toBe('codex')
    expect(copilot.name).toBe('copilot')
    expect(deepseek.name).toBe('deepseek')
    expect(cursor.name).toBe('cursor')
    expect(devin.name).toBe('devin')
    expect(droid.name).toBe('droid')
    expect(gemini.name).toBe('gemini')
    expect(jcode.name).toBe('jcode')
    expect(junie.name).toBe('junie')
    expect(kilo.name).toBe('kilo')
    expect(omp.name).toBe('omp')
    expect(openhands.name).toBe('openhands')
    expect(opencode.name).toBe('opencode')
    expect(pi.name).toBe('pi')
    expect(qoder.name).toBe('qoder')
    expect(reasonix.name).toBe('reasonix')
    expect(vtcode.name).toBe('vtcode')
  })
})

describe('planning exports', () => {
  it('re-exports inspection and update planning helpers', async () => {
    const agent = getAgentByNameOrAlias('codex')
    expect(agent).toBeDefined()

    expect(typeof inspectAgent).toBe('function')

    const plan = createUpdatePlan([
      {
        agent: agent!,
        inPath: false,
        lifecycle: 'unmanaged',
        methods: [],
        sourceLabel: 'not installed',
        updateLabel: 'manual',
      },
    ])

    expect(Array.isArray(plan.entries)).toBe(true)
  })
})
