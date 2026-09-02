import type { AgentExecutableObservation } from './agent-observation'
import type { LifecycleObservation } from './model'

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
