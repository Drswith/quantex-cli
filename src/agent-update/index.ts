// KEEP (S1): published v1 agent-update facade (strategy, messages, self-update).
// Compatibility re-exports this barrel. Not a leftover pass-through to delete.
// S1 leftover scan: KEEP product-path hang here (thick-area zero-ref; do not restore src/lifecycle).
export {
  createSupersededPackageWarning,
  getAgentUpdateFailureHint,
  getManualAgentUpdateMessage,
  getSupersededPackageMessage,
  getUntrackedPathAgentUpdateMessage,
} from './messages'
export { executeAgentSelfUpdate } from './self-update'
export {
  agentUpdateProviders,
  canResolveAgentUpdate,
  getAgentUpdateStrategy,
  resolveAgentUpdateProvider,
} from './providers'
export type { AgentUpdateContext, AgentUpdateProvider, AgentUpdateStrategy } from './types'
