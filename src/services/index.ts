export { inspectRegisteredAgents, resolveAgent, resolveAgentInspection } from './agents'
export type { ResolvedAgentInspection } from './agents'
export {
  type AgentExecutionOutcome,
  type ExecuteAgentLifecycleInput,
  executeAgentLifecycle,
  type LifecycleExecutionObservedAgent,
  type LifecycleExecutionServicePorts,
} from './lifecycle-execution'
export {
  createProductionLifecycleExecutionService,
  type ProductionLifecycleExecutionDependencies,
  type ProductionLifecycleExecutionOptions,
  type ProductionLifecycleExecutionService,
} from './lifecycle-execution-production'
export { getSingleAgentUpdateStatus, planAgentUpdates } from './update'
export type { ManagedUpdateBucket, PendingAgentUpdate, PlannedAgentUpdates, SingleAgentUpdateStatus } from './update'
export { createProductionSelfUpgradeInvocation, type ProductionSelfUpgradeInvocation } from './self-upgrade-production'
