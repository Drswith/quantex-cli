import { describe, expect, it } from 'vitest'
import { getAllAgents } from '../src/agents'
import { getCatalogAgent } from '../src/agents/catalog'
import { catalogData } from '../src/agents/generated/catalog-data'

const migratedProviders = new Set(['cargo', 'deno', 'pip', 'uv'])

describe('normalized Cargo, Deno, pip, and uv catalog entries', () => {
  it('stores provider-bound targets, arguments, and only supported probes', () => {
    for (const rawEntry of catalogData as unknown as Array<Record<string, any>>) {
      for (const candidates of Object.values(rawEntry.platforms) as Array<Array<Record<string, any>>>) {
        for (const candidate of candidates) {
          expect(migratedProviders.has(candidate.type)).toBe(false)
          if (!migratedProviders.has(candidate.provider)) continue

          expect(candidate.target.id).toBeTypeOf('string')
          expect(candidate.target.kind).toBe(['deno', 'uv'].includes(candidate.provider) ? 'tool' : 'package')
          expect(candidate.probes).toContain('executable-presence')
          expect(candidate.probes.includes('package-presence')).toBe(candidate.provider === 'uv')
          expect(candidate.probes.includes('installed-version')).toBe(candidate.provider === 'uv')
          expect(candidate.probes).not.toContain('target-version')
          expect(rawEntry.packages?.[candidate.provider]).toBeUndefined()
        }
      }
    }
  })

  it('preserves Deno arguments in the legacy projection', () => {
    expect(getCatalogAgent('genie').platforms.linux?.find(method => method.type === 'deno')).toEqual({
      packageInstallArgs: ['-A'],
      type: 'deno',
    })
  })

  it('projects no cargo, mise, pip, or uv method, because those providers are ineligible', () => {
    for (const agent of getAllAgents()) {
      for (const methods of Object.values(agent.platforms)) {
        for (const method of methods ?? []) {
          expect(['cargo', 'mise', 'pip', 'uv']).not.toContain(method.type)
        }
      }
    }
  })
})
