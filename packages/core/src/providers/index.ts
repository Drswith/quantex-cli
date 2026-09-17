// KEEP (S3): first-party provider domain barrel (registry / invoke / types).
// Live importers across Core, package-manager, and services. Not a leftover
// pass-through of a single adapter.
// S3 leftover scan: KEEP product-path hang here (Core-internal leftover; do not restore src/lifecycle).
// Product-path keep so the relocate-core-providers archive PR still
// runs the macOS test matrix. Hang leftover classify presence on this existing
// packages/core/src/providers file, not a restored src/providers runtime tree.
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
