import type { LifecycleObservation } from '../core/lifecycle/model'
// KEEP (P8): Core execution-executor consumes planAgentExecutionPreflight via the
// lifecycle barrel. Differential install-policy preflight, not a pass-through.
// Do not fold into src/core — Core wraps it with launch/install; tests cover the planner.
import type { AgentExecutableObservation } from './agent-observation'

export type AgentExecutionInstallPolicy = 'always' | 'if-missing' | 'never' | 'prompt'

export interface AgentExecutionPreflightInput {
  readonly dryRun: boolean
  readonly executable: AgentExecutableObservation
  readonly installPolicy: AgentExecutionInstallPolicy
  readonly interactive: boolean
  readonly observation: LifecycleObservation
}

export type AgentExecutionPreflightPlan =
  | { readonly decision: 'dry-run' | 'install-and-launch' | 'launch' | 'prompt-install' }
  | {
      readonly decision: 'reject'
      readonly errorCode: 'AGENT_NOT_INSTALLED' | 'INTERACTION_REQUIRED'
    }

export function planAgentExecutionPreflight(input: AgentExecutionPreflightInput): AgentExecutionPreflightPlan {
  if (input.executable.present) return { decision: input.dryRun ? 'dry-run' : 'launch' }
  if (input.installPolicy === 'never') return { decision: 'reject', errorCode: 'AGENT_NOT_INSTALLED' }
  if (input.installPolicy === 'prompt' && !input.interactive) {
    return { decision: 'reject', errorCode: 'INTERACTION_REQUIRED' }
  }
  if (input.dryRun) return { decision: 'dry-run' }
  return { decision: input.installPolicy === 'prompt' ? 'prompt-install' : 'install-and-launch' }
}
