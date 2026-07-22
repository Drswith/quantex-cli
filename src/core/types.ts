import type { Platform } from '../agents/types'

export type CoreErrorCode =
  | 'agent-not-found'
  | 'cancelled'
  | 'inspection-failed'
  | 'invalid-request'
  | 'invalid-state'
  | 'timed-out'

export interface CoreError {
  readonly code: CoreErrorCode
  readonly details?: Readonly<Record<string, unknown>>
  readonly message: string
  readonly remediation?: string
  readonly retryable: boolean
}

export type CoreResult<T> = { readonly ok: true; readonly value: T } | { readonly error: CoreError; readonly ok: false }

export interface CoreRequestOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
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

export interface Quantex {
  inspect(name: string, options?: CoreRequestOptions): Promise<CoreResult<AgentInspection>>
  list(options?: CoreRequestOptions): Promise<CoreResult<readonly AgentDescriptor[]>>
}
