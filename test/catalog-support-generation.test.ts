import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { buildAgentCatalogManifest } from '../scripts/write-agent-catalog-manifest'

describe('generated catalog support inputs', () => {
  it('derives provider, platform, target-kind, and probe coverage from normalized candidates', async () => {
    const manifest = await buildAgentCatalogManifest()
    const support = JSON.parse(manifest.catalogSupportSource)

    expect(support.schemaVersion).toBe(1)
    expect(support.agents).toHaveLength(37)
    expect(support.providers.npm.platforms).toEqual(['linux', 'macos', 'windows'])
    expect(support.providers.npm.targetKinds).toEqual(['package'])
    expect(support.providers.npm.probes).toEqual([
      'executable-presence',
      'installed-version',
      'package-presence',
      'target-version',
    ])
    expect(support.providers.script.targetKinds).toEqual(['script'])
    expect(manifest.catalogSupportMarkdown).toContain('| `npm` |')
    expect(manifest.catalogSupportMarkdown).toContain('| `script` |')
  })

  it('keeps checked-in support outputs byte-for-byte reproducible', async () => {
    const manifest = await buildAgentCatalogManifest()
    const checkedJson = await readFile(new URL('../src/agents/generated/catalog-support.json', import.meta.url), 'utf8')
    const checkedMarkdown = await readFile(
      new URL('../docs/generated/agent-provider-support.md', import.meta.url),
      'utf8',
    )

    expect(checkedJson).toBe(manifest.catalogSupportSource)
    expect(checkedMarkdown).toBe(manifest.catalogSupportMarkdown)
  })
})
