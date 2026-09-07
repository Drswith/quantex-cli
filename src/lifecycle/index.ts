// KEEP (P8 / L1 / L2 / L3): Used barrel (services, idempotency). L1 moved receipt
// types, L2 moved provider-binding/evidence, L3 moved observation/planner/
// execution/postcondition. This barrel re-exports them as an existing non-SDK
// path. Do not delete this directory in L3 (L4).
// Product-path touch so the lifecycle-provider-core-internal-l2 archive PR still runs the macOS test matrix.
export {
  type AgentExecutionInstallPolicy,
  type AgentExecutionPreflightInput,
  type AgentExecutionPreflightPlan,
  planAgentExecutionPreflight,
} from '../core/lifecycle/agent-execution'
export type {
  LifecycleDrift,
  LifecycleEffect,
  LifecycleIntent,
  LifecycleObservation,
  LifecycleOutcome,
  LifecyclePlan,
  LifecyclePlanningProvider,
  LifecyclePostcondition,
  LifecycleReceipt,
  LifecycleStep,
  LifecycleVerification,
  ProviderCapability,
} from '../core/lifecycle/model'
export { LIFECYCLE_RECEIPT_SCHEMA_VERSION } from '../core/lifecycle/model'
export {
  type LifecycleUpdateDecision,
  type LifecycleUpdatePlanningInput,
  type LifecycleUpdatePlanningResult,
  planLifecycleUpdate,
  projectLifecycleProviderCapabilities,
} from '../core/lifecycle/update-planner'
export {
  type AgentExecutableObservation,
  type AgentLifecycleObservationPorts,
  type AgentLifecycleObservationResult,
  observeAgentLifecycle,
} from '../core/lifecycle/agent-observation'
export {
  type CatalogProviderEvidence,
  type LifecycleProviderBinding,
  type ObserveLifecycleProviderOptions,
  observeLifecycleProvider,
  providerBindingsEqual,
  resolveCatalogProviderBindings,
  resolveCatalogProviderEvidence,
  resolvePersistedProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from '../core/lifecycle/provider-evidence'
