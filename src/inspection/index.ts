// KEEP (S1): published v1 inspection convenience barrel. Compatibility and
// CLI read projection import this path. Not a leftover pass-through.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
export { inspectAgent, inspectAllAgents } from './agents'
export type { AgentInspection } from './agents'
