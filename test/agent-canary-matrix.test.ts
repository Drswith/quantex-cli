import { describe, expect, it } from 'vitest'
import { QUICK_CANARY_AGENTS, resolveCanaryMatrix } from '../scripts/ci/agent-canary-matrix'

describe('agent canary matrix', () => {
  it('keeps the quick scope deterministic and includes Pi', async () => {
    const matrix = await resolveCanaryMatrix('quick')

    expect(matrix.include.map(entry => entry.agent)).toEqual([...QUICK_CANARY_AGENTS].sort())
    expect(matrix.include.find(entry => entry.agent === 'pi')).toMatchObject({
      provider: 'bun',
      requireVersion: true,
    })
  })

  it('includes every Linux catalog agent in the full scope', async () => {
    const matrix = await resolveCanaryMatrix('full')

    expect(matrix.include.length).toBeGreaterThanOrEqual(QUICK_CANARY_AGENTS.length)
    expect(new Set(matrix.include.map(entry => entry.agent)).size).toBe(matrix.include.length)
    expect(matrix.include.every(entry => entry.agent && entry.provider)).toBe(true)
  })

  it('rejects an invalid scope', async () => {
    await expect(resolveCanaryMatrix('invalid' as never)).rejects.toThrow('Expected quick or full')
  })
})
