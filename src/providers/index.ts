// KEEP (S1): first-party provider domain barrel (registry / invoke / types).
// Live importers across Core, package-manager, and services. Not a leftover
// pass-through of a single adapter.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
export {
  createProviderRegistry,
  defineFirstPartyProviderRegistry,
  deriveProviderCapabilities,
  type ProviderRegistry,
} from './registry'
export { invokeProviderOperation } from './invoke'
export { firstPartyProviderRegistry } from './first-party'
export {
  firstPartyProviderIds,
  type FirstPartyProviderAdapterMap,
  type ProviderAdapter,
  type ProviderAvailability,
  type ProviderBatchUpdateRequest,
  type ProviderEvidence,
  type ProviderExecutionEffect,
  type ProviderId,
  type ProviderMutationEvidence,
  type ProviderObservation,
  type ProviderOptionalOperation,
  type ProviderOperation,
  type ProviderOperationContext,
  type ProviderOutcome,
  type ProviderResolvedVersion,
  type ProviderResourceCleanup,
  type ProviderTarget,
  type ProviderTargetKind,
  type ProviderTargetOperation,
  type ProviderTargetRequest,
  type ProviderVerification,
  type RegistryPackageOperationOptions,
  type RegistryPackageUpdateStrategy,
} from './types'
