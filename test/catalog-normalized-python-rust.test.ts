import { describe, expect, it } from 'vitest'
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

  it('preserves Cargo/Deno arguments and legacy explicit package-name projection', () => {
    expect(getCatalogAgent('codewhale').platforms.linux?.find(method => method.type === 'cargo')).toEqual({
      packageInstallArgs: ['--locked'],
      type: 'cargo',
    })
    expect(getCatalogAgent('genie').platforms.linux?.find(method => method.type === 'deno')).toEqual({
      packageInstallArgs: ['-A'],
      type: 'deno',
    })
    expect(
      getCatalogAgent('vibe').platforms.linux?.filter(method => method.type === 'uv' || method.type === 'pip'),
    ).toEqual([
      { packageName: 'mistral-vibe', type: 'uv' },
      { packageName: 'mistral-vibe', type: 'pip' },
    ])
  })
})
