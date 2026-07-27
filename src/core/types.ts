import type { Platform } from '../agents/types'

export type CoreErrorCode =
  | 'agent-not-found'
  | 'cancelled'
  | 'compensation-failed'
  | 'decision-conflict'
  | 'decision-indeterminate'
  | 'execution-failed'
  | 'inspection-failed'
  | 'invalid-request'
  | 'invalid-state'
  | 'recipe-unavailable'
  | 'recording-failed'
  | 'timed-out'
  | 'verification-failed'

export interface CoreError {
  readonly code: CoreErrorCode
  readonly details?: Readonly<Record<string, unknown>>
  readonly message: string
  readonly remediation?: string
  readonly retryable: boolean
}

export type CoreResult<T, E extends CoreError = CoreError> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: E; readonly ok: false }

export interface CoreRequestOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface AgentMutationOptions extends CoreRequestOptions {
  readonly mode?: 'apply' | 'preview'
}

export interface CreateQuantexOptions {
  readonly configDir?: string
}

export interface AgentDescriptor {
  readonly aliases: readonly string[]
  readonly binaryName: string
  readonly displayName: string
  readonly homepage: string
  readonly name: string
  readonly platforms: readonly Platform[]
}

export interface AgentSource {
  readonly provider: string
  readonly target: string
  readonly targetKind: 'binary' | 'cask' | 'formula' | 'id' | 'package' | 'script' | 'tool'
}

interface AgentInspectionBase {
  readonly agent: AgentDescriptor
  readonly observedAt?: string
}

interface PresentAgentInspectionBase extends AgentInspectionBase {
  readonly executablePath?: string
  readonly version?: string
}

export interface ManagedAgentInspection extends PresentAgentInspectionBase {
  readonly source: AgentSource
  readonly status: 'managed'
}

export interface ExternalAgentInspection extends PresentAgentInspectionBase {
  readonly detectedSource?: AgentSource
  readonly status: 'external'
}

export interface MissingAgentInspection extends AgentInspectionBase {
  readonly status: 'missing'
}

export interface StaleAgentInspection extends AgentInspectionBase {
  readonly recordedSource: AgentSource
  readonly reason: string
  readonly status: 'stale'
}

export interface ConflictAgentInspection extends PresentAgentInspectionBase {
  readonly detectedSource?: AgentSource
  readonly reason: string
  readonly recordedSource?: AgentSource
  readonly status: 'conflict'
}

export interface IndeterminateAgentInspection extends PresentAgentInspectionBase {
  readonly detectedSource?: AgentSource
  readonly reason: string
  readonly recordedSource?: AgentSource
  readonly status: 'indeterminate'
}

export type AgentInspection =
  | ConflictAgentInspection
  | ExternalAgentInspection
  | IndeterminateAgentInspection
  | ManagedAgentInspection
  | MissingAgentInspection
  | StaleAgentInspection

export type AgentMutationDecision = 'already-satisfied' | 'external-preserved' | 'install' | 'reinstall'

export type AgentMutationFailureCode =
  | 'compensation-failed'
  | 'decision-conflict'
  | 'decision-indeterminate'
  | 'execution-failed'
  | 'recipe-unavailable'
  | 'recording-failed'
  | 'verification-failed'

export type AgentMutationPhase = 'decide' | 'execute' | 'verify' | 'record' | 'compensate'
export type AgentMutationSideEffect = 'none' | 'compensated' | 'may-remain'

export interface AgentMutationFailureDetails extends Readonly<Record<string, unknown>> {
  readonly phase: AgentMutationPhase
  readonly sideEffect: AgentMutationSideEffect
}

export type AgentMutationError =
  | (Omit<CoreError, 'code' | 'details'> & {
      readonly code: AgentMutationFailureCode
      readonly details: AgentMutationFailureDetails
    })
  | (Omit<CoreError, 'code'> & {
      readonly code: 'agent-not-found' | 'cancelled' | 'invalid-request' | 'invalid-state' | 'timed-out'
    })

export type AgentMutation =
  | {
      readonly before: AgentInspection
      readonly decision: AgentMutationDecision
      readonly mode: 'preview'
      readonly source?: AgentSource
      readonly wouldChange: boolean
    }
  | {
      readonly after: AgentInspection
      readonly before: AgentInspection
      readonly changed: boolean
      readonly decision: AgentMutationDecision
      readonly mode: 'apply'
      readonly source?: AgentSource
    }

export interface Quantex {
  ensure(name: string, options?: AgentMutationOptions): Promise<CoreResult<AgentMutation, AgentMutationError>>
  inspect(name: string, options?: CoreRequestOptions): Promise<CoreResult<AgentInspection>>
  install(name: string, options?: AgentMutationOptions): Promise<CoreResult<AgentMutation, AgentMutationError>>
  list(options?: CoreRequestOptions): Promise<CoreResult<readonly AgentDescriptor[]>>
}
