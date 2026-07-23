import type { LifecycleProviderBinding } from '../lifecycle/provider-binding'
import type {
  ProviderMutationEvidence,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderVerification,
} from '../providers/types'
import type { InstalledAgentState } from '../state/schema'
import type { CoreInstallationDecision, CoreInstallationDirective } from './installation-decision'
import type { CoreInvocationContext } from './invocation'
import type { CoreAgentObservation } from './production-observation'
import type { AgentMutationFailureCode, AgentMutationPhase, AgentMutationSideEffect } from './types'

export type CoreMutationPhase = AgentMutationPhase
export type CoreMutationSideEffect = AgentMutationSideEffect

export interface CoreInstallationRecipe {
  readonly binding: LifecycleProviderBinding
  readonly compensation: 'manual' | 'provider-uninstall'
  /** Existing schema-v2 projection used by both Core and the maintained v1 CLI. */
  readonly installedState: InstalledAgentState
  /** Resolution must conclusively prove absence before this recipe can be returned. */
  readonly ownership: 'created-on-success'
}

export type CoreInstallationRecipeResolution =
  | { readonly kind: 'ready'; readonly recipe: CoreInstallationRecipe }
  | {
      readonly kind: 'blocked'
      readonly reason: string
      readonly remediation?: string
      readonly retryable: boolean
    }
  | {
      readonly kind: 'interrupted'
      readonly outcome: CoreMutationInterruptionOutcome
    }

export type CoreMutationInterruptionOutcome =
  | { readonly kind: 'cancelled'; readonly reason?: string }
  | { readonly kind: 'timed-out'; readonly timeoutMs: number }

export interface CoreInstallationStateRecord {
  apply(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface CoreInstallationExecutorPorts {
  compensate(
    recipe: CoreInstallationRecipe,
    context: ProviderOperationContext,
  ): Promise<ProviderOutcome<ProviderMutationEvidence>>
  install(
    recipe: CoreInstallationRecipe,
    context: ProviderOperationContext,
  ): Promise<ProviderOutcome<ProviderMutationEvidence>>
  observe(name: string, context: CoreInvocationContext): Promise<CoreAgentObservation | undefined>
  prepareRecord(input: {
    readonly before: CoreAgentObservation
    readonly context: CoreInvocationContext
    readonly recipe: CoreInstallationRecipe
    readonly verified: CoreAgentObservation
  }): Promise<CoreInstallationStateRecord>
  resolveRecipe(input: {
    readonly context: ProviderOperationContext
    readonly directive: Extract<CoreInstallationDirective, { readonly wouldChange: true }>
    readonly observed: CoreAgentObservation
    readonly operation: 'ensure' | 'install'
  }): Promise<CoreInstallationRecipeResolution>
  verify(
    recipe: CoreInstallationRecipe,
    context: ProviderOperationContext,
  ): Promise<ProviderOutcome<ProviderVerification>>
  withMutationLock<T>(name: string, context: CoreInvocationContext, run: () => Promise<T>): Promise<T>
}

export type CoreInstallationExecutionValue =
  | {
      readonly before: CoreAgentObservation
      readonly binding?: LifecycleProviderBinding
      readonly decision: CoreInstallationDecision
      readonly kind: 'preview'
      readonly wouldChange: boolean
    }
  | {
      readonly after: CoreAgentObservation
      readonly before: CoreAgentObservation
      readonly binding?: LifecycleProviderBinding
      readonly changed: boolean
      readonly decision: CoreInstallationDecision
      readonly kind: 'apply'
    }

export type CoreInstallationExecutionOutcome =
  | { readonly kind: 'success'; readonly value: CoreInstallationExecutionValue }
  | { readonly kind: 'agent-not-found'; readonly name: string }
  | { readonly error: CoreMutationFailure; readonly kind: 'failed' }

export interface CoreMutationFailure {
  readonly code: AgentMutationFailureCode
  readonly phase: CoreMutationPhase
  readonly reason: string
  readonly remediation?: string
  readonly retryable: boolean
  readonly sideEffect: CoreMutationSideEffect
}
