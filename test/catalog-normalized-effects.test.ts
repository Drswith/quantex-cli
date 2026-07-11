import { describe, expect, it } from 'vitest'
import { getCatalogAgent } from '../src/agents/catalog'
import { catalogData } from '../src/agents/generated/catalog-data'

const migratedProviders = new Set(['binary', 'script'])

describe('normalized script and standalone-binary catalog entries', () => {
  it('stores exact effects and source identities without legacy methods', () => {
    for (const rawEntry of catalogData as unknown as Array<Record<string, any>>) {
      for (const candidates of Object.values(rawEntry.platforms) as Array<Array<Record<string, any>>>) {
        for (const candidate of candidates) {
          expect(migratedProviders.has(candidate.type)).toBe(false)
          if (!migratedProviders.has(candidate.provider)) continue

          expect(candidate.target.kind).toBe(candidate.provider)
          expect(candidate.target.id).toMatch(/^https?:\/\//)
          expect(candidate.target.effect.kind).toBe('shell-script')
          expect(candidate.target.effect.command).toContain(candidate.target.id)
          expect(candidate.probes).toEqual(['executable-presence'])
        }
      }
    }
  })

  it('preserves representative PowerShell, shell, and query-string commands exactly', () => {
    expect(getCatalogAgent('antigravity').platforms.windows?.find(method => method.type === 'script')).toEqual({
      command: 'irm https://antigravity.google/cli/install.ps1 | iex',
      type: 'script',
    })
    expect(getCatalogAgent('antigravity').platforms.linux?.find(method => method.type === 'script')).toEqual({
      command: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      type: 'script',
    })
    expect(getCatalogAgent('cursor').platforms.windows?.find(method => method.type === 'script')).toEqual({
      command: "irm 'https://cursor.com/install?win32=true' | iex",
      type: 'script',
    })
  })
})
