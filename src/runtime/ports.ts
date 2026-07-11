export type RuntimeFailureKind =
  | 'cancelled'
  | 'conflict'
  | 'failed'
  | 'invalid-data'
  | 'not-found'
  | 'timed-out'
  | 'unavailable'

export interface RuntimeFailure {
  readonly code?: string
  readonly details?: Readonly<Record<string, unknown>>
  readonly kind: RuntimeFailureKind
  readonly message: string
  readonly retryable?: boolean
}

export type RuntimeOutcome<T> =
  | { readonly kind: 'failure'; readonly error: RuntimeFailure }
  | { readonly kind: 'success'; readonly value: T }

export interface ClockSleepRequest {
  readonly durationMs: number
  readonly signal: AbortSignal
}

export interface ClockPort {
  now(): number
  sleep(request: ClockSleepRequest): Promise<RuntimeOutcome<void>>
}

export interface ProcessRequest {
  readonly argv: readonly string[]
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly signal: AbortSignal
  readonly stdio?: readonly [ProcessStdio, ProcessStdio, ProcessStdio]
  readonly timeoutMs?: number
}

export type ProcessStdio = 'ignore' | 'inherit' | 'pipe'

export interface ProcessResult {
  readonly exitCode: number | null
  readonly stderr?: Uint8Array
  readonly stdout?: Uint8Array
  readonly terminationSignal?: string
}

export interface ProcessPort {
  run(request: ProcessRequest): Promise<RuntimeOutcome<ProcessResult>>
}

export interface FileReadRequest {
  readonly path: string
  readonly signal: AbortSignal
}

export interface FileWriteRequest extends FileReadRequest {
  readonly data: string | Uint8Array
}

export interface FileRemoveRequest extends FileReadRequest {
  readonly recursive?: boolean
}

export interface DirectoryCreateRequest extends FileReadRequest {
  readonly recursive?: boolean
}

export interface FileRenameRequest {
  readonly from: string
  readonly signal: AbortSignal
  readonly to: string
}

export interface FileSystemPort {
  makeDirectory(request: DirectoryCreateRequest): Promise<RuntimeOutcome<void>>
  readFile(request: FileReadRequest): Promise<RuntimeOutcome<Uint8Array>>
  remove(request: FileRemoveRequest): Promise<RuntimeOutcome<void>>
  rename(request: FileRenameRequest): Promise<RuntimeOutcome<void>>
  writeFile(request: FileWriteRequest): Promise<RuntimeOutcome<void>>
}

export interface NetworkRequest {
  readonly body?: Uint8Array
  readonly headers?: Readonly<Record<string, string>>
  readonly method?: string
  readonly signal: AbortSignal
  readonly timeoutMs?: number
  readonly url: string
}

export interface NetworkResponse {
  readonly body: Uint8Array
  readonly headers: Readonly<Record<string, string>>
  readonly status: number
}

export interface NetworkPort {
  request(request: NetworkRequest): Promise<RuntimeOutcome<NetworkResponse>>
}

export interface LockAcquireRequest {
  readonly resource: string
  readonly scope: readonly string[]
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export interface LockLease {
  /** Idempotent cleanup that must not depend on the acquisition signal. */
  release(): Promise<RuntimeOutcome<void>>
}

export interface LockPort {
  acquire(request: LockAcquireRequest): Promise<RuntimeOutcome<LockLease>>
}

export interface CacheReadRequest {
  readonly key: string
  readonly signal: AbortSignal
}

export interface CacheWriteRequest extends CacheReadRequest {
  readonly expiresAtMs?: number
  readonly value: unknown
}

export type CacheLookup =
  | { readonly kind: 'hit'; readonly expiresAtMs?: number; readonly value: unknown }
  | { readonly kind: 'miss' }

export interface CachePort {
  read(request: CacheReadRequest): Promise<RuntimeOutcome<CacheLookup>>
  remove(request: CacheReadRequest): Promise<RuntimeOutcome<void>>
  write(request: CacheWriteRequest): Promise<RuntimeOutcome<void>>
}

export interface PersistenceReadRequest {
  readonly key: string
  readonly signal: AbortSignal
}

export interface PersistenceWriteRequest extends PersistenceReadRequest {
  readonly value: unknown
}

export interface PersistenceSnapshot {
  readonly revision?: string
  readonly value: unknown
}

export type PersistenceLookup =
  | { readonly kind: 'found'; readonly snapshot: PersistenceSnapshot }
  | { readonly kind: 'missing' }

export interface PersistenceWriteResult {
  readonly revision?: string
}

export interface PersistencePort {
  load(request: PersistenceReadRequest): Promise<RuntimeOutcome<PersistenceLookup>>
  remove(request: PersistenceReadRequest): Promise<RuntimeOutcome<void>>
  save(request: PersistenceWriteRequest): Promise<RuntimeOutcome<PersistenceWriteResult>>
}

export interface RuntimePorts {
  readonly cache: CachePort
  readonly clock: ClockPort
  readonly fileSystem: FileSystemPort
  readonly locks: LockPort
  readonly network: NetworkPort
  readonly persistence: PersistencePort
  readonly process: ProcessPort
}
