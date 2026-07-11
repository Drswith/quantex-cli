import { describe, expect, it } from 'vitest'
import { projectCatalogInstallCandidate } from '../src/agents/catalog'
import { catalogSourceEntrySchema, normalizedInstallCandidateSchema } from '../src/agents/schema'

describe('normalized catalog candidate schema', () => {
  it('binds registry package provider and target identity in one strict candidate', () => {
    const candidate = normalizedInstallCandidateSchema.parse({
      probes: ['executable-presence', 'installed-version', 'package-presence', 'target-version'],
      provider: 'npm',
      target: { id: '@openai/codex', kind: 'package' },
    })

    expect(candidate).toEqual({
      probes: ['executable-presence', 'installed-version', 'package-presence', 'target-version'],
      provider: 'npm',
      target: { id: '@openai/codex', kind: 'package' },
    })
    expect(() =>
      normalizedInstallCandidateSchema.parse({
        packageName: '@openai/codex',
        provider: 'npm',
        target: { id: '@openai/codex', kind: 'package' },
      }),
    ).toThrow()
  })

  it('rejects provider-specific target kind mismatches', () => {
    expect(() =>
      normalizedInstallCandidateSchema.parse({
        provider: 'npm',
        target: { id: '@openai/codex', kind: 'cask' },
      }),
    ).toThrow()
    expect(() =>
      normalizedInstallCandidateSchema.parse({
        provider: 'script',
        target: { id: 'codex-installer', kind: 'script' },
      }),
    ).toThrow()
  })

  it('models shell-script and executable effects without changing legacy method projection', () => {
    expect(
      projectCatalogInstallCandidate({
        provider: 'script',
        target: {
          effect: { command: 'curl -fsSL https://example.com/install.sh | sh', kind: 'shell-script' },
          id: 'example-installer',
          kind: 'script',
        },
      }),
    ).toEqual({
      command: 'curl -fsSL https://example.com/install.sh | sh',
      type: 'script',
    })
    expect(
      projectCatalogInstallCandidate({
        provider: 'uv',
        target: { arguments: ['--python', '3.12'], id: 'example-tool', kind: 'tool' },
      }),
    ).toEqual({
      packageInstallArgs: ['--python', '3.12'],
      type: 'uv',
    })
  })

  it('allows legacy and normalized candidates to coexist during staged migration', () => {
    const entry = catalogSourceEntrySchema.parse({
      binaryName: 'example',
      displayName: 'Example',
      homepage: 'https://example.com',
      name: 'example',
      platforms: {
        linux: [
          { type: 'npm' },
          {
            provider: 'brew',
            target: { id: 'example/tap/example', kind: 'formula' },
          },
        ],
      },
    })

    expect(entry.platforms.linux).toHaveLength(2)
  })
})
