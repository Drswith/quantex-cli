export const firstPartyProviderIds = Object.freeze([
  'bun',
  'npm',
  'brew',
  'cargo',
  'deno',
  'mise',
  'pip',
  'uv',
  'winget',
  'script',
  'binary',
] as const)

export type ProviderId = (typeof firstPartyProviderIds)[number]

export type ProviderTargetKind = 'binary' | 'cask' | 'formula' | 'id' | 'package' | 'script' | 'tool'

export type ProviderExecutionEffect =
  | { readonly command: readonly string[]; readonly kind: 'executable' }
  | { readonly command: string; readonly kind: 'shell-script' }

export interface ProviderTarget {
  readonly arguments?: readonly string[]
  readonly binaryName?: string
  readonly effect?: ProviderExecutionEffect
  readonly id: string
  readonly kind: ProviderTargetKind
}

export interface ProviderOperationContext {
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export type RegistryPackageUpdateStrategy = 'latest-major' | 'respect-semver'

export interface RegistryPackageOperationOptions {
  readonly distTag?: string
  readonly registry?: string
  readonly updateStrategy?: RegistryPackageUpdateStrategy
}

export interface ProviderAvailability {
  readonly executable?: string
  readonly version?: string
}

export type ProviderObservation =
  | {
      readonly evidence?: readonly ProviderEvidence[]
      readonly kind: 'absent'
      readonly target: ProviderTarget
    }
  | {
      readonly evidence?: readonly ProviderEvidence[]
      readonly executablePath?: string
      readonly kind: 'present'
      readonly target: ProviderTarget
      readonly version?: string
    }

export interface ProviderResolvedVersion {
  readonly evidence?: readonly ProviderEvidence[]
  readonly version: string
}

export interface ProviderMutationEvidence {
  readonly evidence: readonly ProviderEvidence[]
  readonly target: ProviderTarget
}

export type ProviderVerification =
  | {
      readonly evidence: readonly ProviderEvidence[]
      readonly kind: 'satisfied'
    }
  | {
      readonly evidence: readonly ProviderEvidence[]
      readonly kind: 'unsatisfied'
      readonly reason: string
    }

export interface ProviderEvidence {
  readonly details?: Readonly<Record<string, unknown>>
  readonly kind: 'command' | 'executable' | 'package' | 'provider'
  readonly value: string
}

export type ProviderOutcome<T> =
  | { readonly kind: 'success'; readonly value: T }
  | {
      readonly kind: 'unsupported'
      readonly operation: ProviderOperation
      readonly reason?: string
    }
  | {
      readonly command?: readonly string[]
      readonly kind: 'unavailable'
      readonly reason: string
      readonly retryable?: boolean
    }
  | {
      readonly command?: readonly string[]
      readonly evidence?: readonly ProviderEvidence[]
      readonly exitCode?: number | null
      readonly kind: 'failed'
      readonly reason: string
      readonly remediation?: string
      readonly retryable: boolean
    }
  | { readonly kind: 'cancelled'; readonly reason?: string }
  | { readonly kind: 'timed-out'; readonly timeoutMs: number }
  | {
      readonly evidence?: readonly ProviderEvidence[]
      readonly kind: 'indeterminate'
      readonly reason: string
    }

export interface ProviderTargetRequest {
  readonly context: ProviderOperationContext
  readonly options?: RegistryPackageOperationOptions
  readonly target: ProviderTarget
}

export interface ProviderBatchUpdateRequest {
  readonly context: ProviderOperationContext
  readonly options?: RegistryPackageOperationOptions
  readonly targets: readonly ProviderTarget[]
}

export type ProviderOperation =
  | 'availability'
  | 'observe'
  | 'resolve-latest-version'
  | 'install'
  | 'update'
  | 'update-many'
  | 'uninstall'
  | 'verify'

export type ProviderOptionalOperation = Exclude<ProviderOperation, 'availability' | 'observe'>
export type ProviderTargetOperation = Exclude<ProviderOptionalOperation, 'update-many'>

export interface ProviderAdapter {
  readonly availability: (context: ProviderOperationContext) => Promise<ProviderOutcome<ProviderAvailability>>
  readonly id: ProviderId
  readonly install?: (request: ProviderTargetRequest) => Promise<ProviderOutcome<ProviderMutationEvidence>>
  readonly observe: (request: ProviderTargetRequest) => Promise<ProviderOutcome<ProviderObservation>>
  readonly resolveLatestVersion?: (request: ProviderTargetRequest) => Promise<ProviderOutcome<ProviderResolvedVersion>>
  readonly uninstall?: (request: ProviderTargetRequest) => Promise<ProviderOutcome<ProviderMutationEvidence>>
  readonly update?: (request: ProviderTargetRequest) => Promise<ProviderOutcome<ProviderMutationEvidence>>
  readonly updateMany?: (request: ProviderBatchUpdateRequest) => Promise<ProviderOutcome<ProviderMutationEvidence[]>>
  readonly verify?: (request: ProviderTargetRequest) => Promise<ProviderOutcome<ProviderVerification>>
}

export type FirstPartyProviderAdapterMap = {
  readonly [Id in ProviderId]: ProviderAdapter & { readonly id: Id }
}
