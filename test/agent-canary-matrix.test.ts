import { describe, expect, it } from 'vitest'
import { QUICK_CANARY_AGENTS, resolveCanaryMatrix } from '../scripts/ci/agent-canary-matrix'
import { getAllAgents } from '../src/agents'

describe('agent canary matrix', () => {
  it('keeps the quick scope deterministic and includes Pi', async () => {
    const matrix = await resolveCanaryMatrix('quick')

    expect(matrix.include.map(entry => entry.agent)).toEqual([...QUICK_CANARY_AGENTS].sort())
    expect(matrix.include.find(entry => entry.agent === 'pi')).toMatchObject({
      coverage: 'full-lifecycle',
      disableUpdates: false,
      provider: 'bun',
      requireVersion: true,
      setup: 'default',
      sourceConflictProbe: false,
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

  it('selects providers the production CLI can actually prefer', async () => {
    const matrix = await resolveCanaryMatrix('full')
    const byAgent = new Map(matrix.include.map(entry => [entry.agent, entry]))

    expect(byAgent.get('amp')?.provider).toBe('npm')
    expect(byAgent.get('autohand')).toMatchObject({ provider: 'npm', requireVersion: true })
    expect(byAgent.get('junie')?.provider).toBe('script')
    expect(byAgent.get('kimi')?.provider).toBe('npm')
    expect(byAgent.get('mimo')?.provider).toBe('npm')
    expect(byAgent.get('openhands')?.provider).toBe('script')
    expect(byAgent.get('openhands')?.requireVersion).toBe(true)
    expect(byAgent.get('vibe')?.provider).toBe('script')
    expect(byAgent.get('vibe')?.requireVersion).toBe(true)
  })

  it('uses explicit credential-free coverage policies instead of agent-level skips', async () => {
    const matrix = await resolveCanaryMatrix('full')
    const byAgent = new Map(matrix.include.map(entry => [entry.agent, entry]))

    expect(byAgent.get('devin')).toMatchObject({
      coverage: 'binary-lifecycle',
      provider: 'script',
      requireVersion: true,
      setup: 'defer-account-setup',
    })
    expect(byAgent.get('goose')).toMatchObject({
      coverage: 'full-lifecycle',
      provider: 'script',
      requireVersion: true,
      setup: 'skip-interactive-configuration',
    })
    expect(byAgent.get('junie')).toMatchObject({
      coverage: 'full-lifecycle',
      provider: 'script',
      requireVersion: true,
      setup: 'default',
    })
    expect(byAgent.get('vibe')).toMatchObject({
      coverage: 'full-lifecycle',
      provider: 'script',
      requireVersion: true,
      setup: 'default',
    })
    for (const entry of matrix.include) {
      expect(entry).not.toHaveProperty('skipReason')
      expect(entry).not.toHaveProperty('cleanupSkipReason')
    }
  })

  it('separates Claude clean ownership from its deliberate source-conflict probe', async () => {
    const matrix = await resolveCanaryMatrix('full')
    const byAgent = new Map(matrix.include.map(entry => [entry.agent, entry]))

    expect(byAgent.get('claude')).toMatchObject({
      coverage: 'full-lifecycle',
      disableUpdates: true,
      provider: 'bun',
      requireVersion: true,
      sourceConflictProbe: true,
    })
    expect(matrix.include.filter(entry => entry.disableUpdates)).toHaveLength(1)
    expect(matrix.include.filter(entry => entry.sourceConflictProbe)).toHaveLength(1)
  })

  it('rejects an invalid scope', async () => {
    await expect(resolveCanaryMatrix('invalid' as never)).rejects.toThrow('Expected quick or full')
  })
})
