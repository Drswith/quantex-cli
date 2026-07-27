import type { CatalogSourceEntry, NormalizedInstallCandidate } from '../../src/agents/schema'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectCoreMutationRecipeCatalog } from '../../scripts/write-core-agent-catalog'
import { catalogData } from '../../src/agents/generated/catalog-data'
import { catalogSourceSchema } from '../../src/agents/schema'
import { loadCoreMutationRecipeCatalog } from '../../src/core/mutation-recipe-catalog'

describe('Core internal mutation recipe catalog', () => {
  it('preserves every validated normalized target without the legacy command projection', async () => {
    const sourceCatalog = catalogSourceSchema.parse(catalogData)
    const recipeCatalog = await loadCoreMutationRecipeCatalog()

    expect(recipeCatalog.map(entry => entry.name)).toEqual(sourceCatalog.map(entry => entry.name))
    for (const sourceEntry of sourceCatalog) {
      const recipeEntry = recipeCatalog.find(entry => entry.name === sourceEntry.name)
      expect(recipeEntry).toBeDefined()

      for (const [platform, candidates] of Object.entries(sourceEntry.platforms)) {
        const normalizedCandidates = candidates?.map(candidate => projectExpectedRecipe(sourceEntry.name, candidate))
        expect(recipeEntry?.platforms[platform as keyof typeof recipeEntry.platforms]).toEqual(normalizedCandidates)
      }
    }

    const shellScriptEffects = recipeCatalog.flatMap(entry =>
      Object.values(entry.platforms).flatMap(recipes =>
        (recipes ?? []).flatMap(recipe =>
          recipe.target.effect?.kind === 'shell-script' ? [recipe.target.effect] : [],
        ),
      ),
    )
    expect(shellScriptEffects.length).toBeGreaterThan(0)
    expect(shellScriptEffects.every(effect => typeof effect.command === 'string')).toBe(true)
  })

  it('keeps executable effects as argv arrays for binary recipes', () => {
    const [agent] = projectCoreMutationRecipeCatalog([binaryFixture()])
    expect(agent?.platforms.linux).toEqual([
      {
        probes: ['executable-presence'],
        provider: 'binary',
        target: {
          effect: {
            command: ['fixture-installer', '--output', 'path with spaces'],
            kind: 'executable',
          },
          id: 'https://example.com/fixture-installer',
          kind: 'binary',
        },
      },
    ])
  })

  it('loads one generated module lazily without a Zod runtime dependency', async () => {
    const first = await loadCoreMutationRecipeCatalog()
    const second = await loadCoreMutationRecipeCatalog()
    const loaderSource = await readFile(join(process.cwd(), 'src/core/mutation-recipe-catalog.ts'), 'utf8')
    const generatedSource = await readFile(join(process.cwd(), 'src/core/generated/mutation-recipe-catalog.ts'), 'utf8')

    expect(second).toBe(first)
    expect(loaderSource).toContain("import('./generated/mutation-recipe-catalog')")
    expect(loaderSource).not.toMatch(/agents\/schema|\bzod\b/u)
    expect(generatedSource).not.toMatch(/agents\/schema|\bzod\b/u)
  })
})

type CatalogCandidate = NonNullable<CatalogSourceEntry['platforms'][keyof CatalogSourceEntry['platforms']]>[number]

function projectExpectedRecipe(
  agentName: string,
  candidate: CatalogCandidate,
): Omit<NormalizedInstallCandidate, 'legacy'> {
  if ('type' in candidate) {
    throw new Error(`${agentName} unexpectedly retains legacy ${candidate.type} catalog metadata.`)
  }
  return {
    ...(candidate.probes ? { probes: candidate.probes } : {}),
    provider: candidate.provider,
    target: candidate.target,
  }
}

function binaryFixture(): CatalogSourceEntry {
  return {
    binaryName: 'fixture',
    displayName: 'Fixture',
    homepage: 'https://example.com/fixture',
    name: 'fixture',
    platforms: {
      linux: [
        {
          probes: ['executable-presence'],
          provider: 'binary',
          target: {
            effect: {
              command: ['fixture-installer', '--output', 'path with spaces'],
              kind: 'executable',
            },
            id: 'https://example.com/fixture-installer',
            kind: 'binary',
          },
        },
      ],
    },
  }
}
