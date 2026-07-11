import { describe, expect, it } from 'vitest'
import { getCatalogAgent } from '../src/agents/catalog'
import { catalogData } from '../src/agents/generated/catalog-data'

const migratedProviders = new Set(['brew', 'winget'])

describe('normalized Homebrew and winget catalog entries', () => {
  it('stores formula, cask, and exact package-ID targets with supported probes', () => {
    for (const rawEntry of catalogData as unknown as Array<Record<string, any>>) {
      for (const candidates of Object.values(rawEntry.platforms) as Array<Array<Record<string, any>>>) {
        for (const candidate of candidates) {
          expect(migratedProviders.has(candidate.type)).toBe(false)
          if (!migratedProviders.has(candidate.provider)) continue

          expect(candidate.target.id).toBeTypeOf('string')
          if (candidate.provider === 'winget') expect(candidate.target.kind).toBe('id')
          else expect(['formula', 'cask']).toContain(candidate.target.kind)
          expect(candidate.probes).toEqual(['executable-presence'])
        }
      }
    }
  })

  it('preserves representative formula, cask, and winget v1 method identities', () => {
    expect(getCatalogAgent('codex').platforms.macos?.find(method => method.type === 'brew')).toEqual({
      packageName: 'codex',
      type: 'brew',
    })
    expect(getCatalogAgent('claude').platforms.macos?.find(method => method.type === 'brew')).toEqual({
      packageName: 'claude-code',
      packageTargetKind: 'cask',
      type: 'brew',
    })
    expect(getCatalogAgent('claude').platforms.windows?.find(method => method.type === 'winget')).toEqual({
      packageName: 'Anthropic.ClaudeCode',
      packageTargetKind: 'id',
      type: 'winget',
    })
  })
})
