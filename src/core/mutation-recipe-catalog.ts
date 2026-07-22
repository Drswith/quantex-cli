import type { Platform } from '../agents/types'
import type { ProviderId, ProviderTarget } from '../providers/types'

export type CoreMutationRecipeProbe =
  | 'executable-presence'
  | 'installed-version'
  | 'package-presence'
  | 'target-version'

export interface CoreMutationRecipe {
  readonly probes?: readonly CoreMutationRecipeProbe[]
  readonly provider: ProviderId
  readonly target: ProviderTarget
}

export interface CoreAgentMutationRecipes {
  readonly name: string
  readonly platforms: Partial<Record<Platform, readonly CoreMutationRecipe[]>>
}

export type CoreMutationRecipeCatalog = readonly CoreAgentMutationRecipes[]

export async function loadCoreMutationRecipeCatalog(): Promise<CoreMutationRecipeCatalog> {
  const { coreMutationRecipeCatalog } = await import('./generated/mutation-recipe-catalog')
  return coreMutationRecipeCatalog
}
