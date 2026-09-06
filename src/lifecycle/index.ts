// KEEP (P8 / L1): Used barrel (Core execution/update/uninstall, services, idempotency).
// L1 moved receipt types to src/core/lifecycle/model; this barrel re-exports them
// as an existing non-SDK path. Remaining engines stay here for L2+.
export {
  type AgentExecutionInstallPolicy,
  type AgentExecutionPreflightInput,
  type AgentExecutionPreflightPlan,
  planAgentExecutionPreflight,
} from './agent-execution'
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
} from './update-planner'
export {
  type AgentExecutableObservation,
  type AgentLifecycleObservationPorts,
  type AgentLifecycleObservationResult,
  observeAgentLifecycle,
} from './agent-observation'
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
} from './provider-evidence'
