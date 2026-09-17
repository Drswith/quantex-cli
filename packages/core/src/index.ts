// KEEP (S3): frozen public Core SDK entry. Runtime export remains createQuantex
// only. Not a leftover pass-through to expand or delete. Do not re-export
// lifecycle helpers or add a Core lifecycle barrel.
// S3 leftover scan: KEEP product-path hang here (Core-internal leftover; do not restore src/lifecycle).
export { createQuantex } from './client'
export type {
  AgentDescriptor,
  AgentInspection,
  AgentMutation,
  AgentMutationDecision,
  AgentMutationError,
  AgentMutationFailureCode,
  AgentMutationFailureDetails,
  AgentMutationOptions,
  AgentMutationPhase,
  AgentMutationSideEffect,
  AgentSource,
  ConflictAgentInspection,
  CoreError,
  CoreErrorCode,
  CoreRequestOptions,
  CoreResult,
  CreateQuantexOptions,
  ExternalAgentInspection,
  IndeterminateAgentInspection,
  ManagedAgentInspection,
  MissingAgentInspection,
  Quantex,
  StaleAgentInspection,
} from './types'
