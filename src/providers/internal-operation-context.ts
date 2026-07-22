import type { ProviderOperationContext } from './types'

export type ProviderOutputPolicy = 'discard' | 'inherit' | 'stderr'

export interface ProviderProcessOperationContext extends ProviderOperationContext {
  readonly outputPolicy?: ProviderOutputPolicy
}

export function getProviderOutputPolicy(context: ProviderOperationContext): ProviderOutputPolicy {
  return (context as ProviderProcessOperationContext).outputPolicy ?? 'discard'
}
