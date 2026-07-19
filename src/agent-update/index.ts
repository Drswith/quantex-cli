export { getAgentUpdateFailureHint, getManualAgentUpdateMessage, getUntrackedPathAgentUpdateMessage } from './messages'
export { executeAgentSelfUpdate } from './self-update'
export {
  agentUpdateProviders,
  canResolveAgentUpdate,
  getAgentUpdateStrategy,
  resolveAgentUpdateProvider,
} from './providers'
export type { AgentUpdateContext, AgentUpdateProvider, AgentUpdateStrategy } from './types'
