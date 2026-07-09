import type { AgentCatalogEntry } from '../src/agents/schema'
import { describe, expect, it, vi } from 'vitest'
import { loadAgentCatalog } from '../src/agents/catalog-loader'
import { catalogData } from '../src/agents/generated/catalog-data'

describe('loadAgentCatalog', () => {
  it('preserves supplied entry order and canonical object identity', () => {
    const source = [catalogData[1], catalogData[0]]
    const loaded = loadAgentCatalog(source)

    expect(loaded.agents.map(agent => agent.name)).toEqual(source.map(agent => agent.name))
    expect(loaded.getAgent(source[0].name)).toBe(loaded.agents[0])
    expect(loaded.getAgent(source[1].name)).toBe(loaded.agents[1])
  })

  it('rejects data that violates the existing catalog schema', () => {
    expect(() =>
      loadAgentCatalog([
        {
          ...catalogData[0],
          platforms: {
            plan9: [{ type: 'npm' }],
          },
        },
      ]),
    ).toThrow()
  })

  it('throws a stable error for an unknown canonical name', () => {
    const loaded = loadAgentCatalog([catalogData[0]])

    expect(() => loaded.getAgent('missing')).toThrow('Unknown catalog agent: missing')
  })

  it('merges runtime-only behavior without mutating serializable data', () => {
    const source = structuredClone(catalogData[0]) as unknown as AgentCatalogEntry
    const parser = vi.fn(() => '1.2.3')
    const loaded = loadAgentCatalog([source], {
      [source.name]: {
        versionProbeParser: parser,
      },
    })

    expect(loaded.agents[0].versionProbe).toEqual({
      ...source.versionProbe,
      parser,
    })
    expect(source.versionProbe).not.toHaveProperty('parser')
  })
})
