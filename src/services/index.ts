// KEEP (P5 / P7 / L5): published v1 facade only (agents + update planning).
// Commands import execution / self-upgrade production modules directly;
// unused barrel re-exports of those leftovers were removed after P0–P4.
// L5 re-scan after lifecycle barrel deletion (#727): still no unused barrel
// leftovers and not a deletable pass-through — src/index.ts publishes this.
export { inspectRegisteredAgents, resolveAgent, resolveAgentInspection } from './agents'
export type { ResolvedAgentInspection } from './agents'
export { getSingleAgentUpdateStatus, planAgentUpdates } from './update'
export type { ManagedUpdateBucket, PendingAgentUpdate, PlannedAgentUpdates, SingleAgentUpdateStatus } from './update'
