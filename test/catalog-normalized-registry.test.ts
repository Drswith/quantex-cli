import { describe, expect, it } from 'vitest'
import { getCatalogAgent } from '../src/agents/catalog'
import { catalogData } from '../src/agents/generated/catalog-data'

const migratedProviders = new Set(['bun', 'mise', 'npm'])

describe('normalized npm, Bun, and mise catalog entries', () => {
  it('stores migrated candidates with bound targets and no duplicate package-map keys', () => {
    for (const rawEntry of catalogData as unknown as Array<Record<string, any>>) {
      const normalizedProviders = new Set(
        (Object.values(rawEntry.platforms) as Array<Array<Record<string, any>>>)
          .flat()
          .map(candidate => candidate.provider)
          .filter(Boolean),
      )
      if (normalizedProviders.has('bun') || normalizedProviders.has('npm')) {
        expect(rawEntry.packages?.npm).toBeUndefined()
      }
      if (normalizedProviders.has('mise')) expect(rawEntry.packages?.mise).toBeUndefined()

      for (const candidates of Object.values(rawEntry.platforms) as Array<Array<Record<string, any>>>) {
        for (const candidate of candidates) {
          expect(migratedProviders.has(candidate.type)).toBe(false)
          if (!migratedProviders.has(candidate.provider)) continue

          expect(candidate.target.id).toBeTypeOf('string')
          expect(candidate.target.id.length).toBeGreaterThan(0)
          expect(candidate.target.kind).toBe(candidate.provider === 'mise' ? 'tool' : 'package')
          expect(candidate.probes).toContain('package-presence')
          expect(candidate.probes).toContain('executable-presence')
          expect(candidate.probes).toContain('installed-version')
          expect(candidate.probes.includes('target-version')).toBe(candidate.provider !== 'mise')
        }
      }
    }
  })

  it('reconstructs the maintained Codex package map and method shapes', () => {
    const codex = getCatalogAgent('codex')

    expect(codex.packages).toEqual({ mise: 'npm:@openai/codex', npm: '@openai/codex' })
    expect(codex.platforms.windows).toEqual([{ type: 'bun' }, { type: 'npm' }, { type: 'mise' }])
    expect(codex.platforms.macos?.slice(0, 3)).toEqual([{ type: 'bun' }, { type: 'npm' }, { type: 'mise' }])
  })
})
