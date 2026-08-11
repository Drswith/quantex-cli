import { describe, expect, it } from 'vitest'
import {
  CANARY_UNSUPPORTED_RUNNER_REASONS,
  QUICK_CANARY_AGENTS,
  resolveCanaryMatrix,
} from '../scripts/ci/agent-canary-matrix'
import { getAllAgents } from '../src/agents'

describe('agent canary matrix', () => {
  it('keeps the quick scope deterministic and includes Pi', async () => {
    const matrix = await resolveCanaryMatrix('quick')

    expect(matrix.include.map(entry => entry.agent)).toEqual([...QUICK_CANARY_AGENTS].sort())
    expect(matrix.include.find(entry => entry.agent === 'pi')).toMatchObject({
      provider: 'bun',
      requireVersion: true,
      skipReason: '',
    })
  })

  it('includes every Linux catalog agent in the full scope', async () => {
    const matrix = await resolveCanaryMatrix('full')
    const expectedAgents = getAllAgents()
      .filter(agent => agent.platforms.linux?.length)
      .map(agent => agent.name)
      .sort()

    expect(matrix.include.map(entry => entry.agent)).toEqual(expectedAgents)
    expect(new Set(matrix.include.map(entry => entry.agent)).size).toBe(matrix.include.length)
    expect(matrix.include.every(entry => entry.agent && entry.provider)).toBe(true)
  })

  it('prefers CI-ready managed candidates over script installers', async () => {
    const matrix = await resolveCanaryMatrix('full')
    const byAgent = new Map(matrix.include.map(entry => [entry.agent, entry]))

    expect(byAgent.get('amp')?.provider).toBe('npm')
    expect(byAgent.get('junie')?.provider).toBe('script')
    expect(byAgent.get('kimi')?.provider).toBe('npm')
    expect(byAgent.get('mimo')?.provider).toBe('npm')
    expect(byAgent.get('vibe')?.provider).toBe('uv')
    expect(byAgent.get('vibe')?.requireVersion).toBe(true)
    expect(byAgent.get('vtcode')?.provider).toBe('script')
  })

  it('keeps non-interactive incompatibilities visible in the full matrix', async () => {
    const matrix = await resolveCanaryMatrix('full')
    const byAgent = new Map(matrix.include.map(entry => [entry.agent, entry]))

    for (const [agent, reason] of Object.entries(CANARY_UNSUPPORTED_RUNNER_REASONS)) {
      expect(reason).toBeTruthy()
      expect(byAgent.get(agent)?.skipReason).toBe(reason)
    }
    expect(matrix.include.filter(entry => entry.skipReason)).toHaveLength(
      Object.keys(CANARY_UNSUPPORTED_RUNNER_REASONS).length,
    )
  })

  it('rejects an invalid scope', async () => {
    await expect(resolveCanaryMatrix('invalid' as never)).rejects.toThrow('Expected quick or full')
  })
})
