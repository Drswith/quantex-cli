export type ProviderCapability = `${string}-${string}`

export type LifecycleIntent =
  | {
      readonly kind: 'install'
      readonly requestedVersion?: string
      readonly targetId: string
    }
  | {
      readonly kind: 'ensure'
      readonly requestedVersion?: string
      readonly targetId: string
    }
  | {
      readonly kind: 'update'
      readonly targetId: string
      readonly targetVersion?: string
    }
  | {
      readonly kind: 'uninstall'
      readonly targetId: string
    }

export type LifecycleDrift =
  | { readonly kind: 'none' }
  | { readonly kind: 'untracked' }
  | { readonly kind: 'recorded-absent' }
  | {
      readonly kind: 'conflicting-source'
      readonly observedProviderId?: string
      readonly recordedProviderId?: string
    }
  | { readonly kind: 'indeterminate'; readonly reason: string }

interface LifecycleObservationBase {
  readonly drift: LifecycleDrift
  readonly observedAt?: string
  readonly targetId: string
}

export type LifecycleObservation =
  | (LifecycleObservationBase & { readonly kind: 'absent' })
  | (LifecycleObservationBase & {
      readonly executablePath?: string
      readonly kind: 'present'
      readonly providerId?: string
      readonly providerTargetId?: string
      readonly providerTargetKind?: 'binary' | 'cask' | 'formula' | 'id' | 'package' | 'script' | 'tool'
      readonly version?: string
    })
  | (LifecycleObservationBase & {
      readonly kind: 'indeterminate'
      readonly reason: string
    })

export type LifecycleProviderTargetKind = NonNullable<
  Extract<LifecycleObservation, { kind: 'present' }>['providerTargetKind']
>

export interface LifecyclePlanningProvider {
  readonly capabilities: readonly string[]
  readonly providerId: string
  readonly targetId: string
  readonly targetKind: LifecycleProviderTargetKind
}

interface ProviderEffectBase {
  readonly capability: ProviderCapability
  readonly providerId?: string
  readonly targetId?: string
}

export type LifecycleEffect =
  | (ProviderEffectBase & { readonly kind: 'provider-observation' })
  | (ProviderEffectBase & { readonly kind: 'provider-mutation' })

export type LifecyclePostcondition =
  | {
      readonly kind: 'package-absent' | 'package-present'
      readonly providerId: string
      readonly targetId: string
    }
  | {
      readonly executable: string
      readonly kind: 'executable-absent' | 'executable-present'
    }
  | {
      readonly expectedVersion: string
      readonly kind: 'version-satisfies'
      readonly targetId: string
    }

interface LifecycleStepBase {
  readonly dependsOn: readonly string[]
  readonly effects: readonly LifecycleEffect[]
  readonly id: string
  readonly postconditions: readonly LifecyclePostcondition[]
  readonly preconditions: readonly LifecyclePostcondition[]
}

export interface LifecycleOperationStep extends LifecycleStepBase {
  readonly compensatesStepId?: never
  readonly kind: 'operation'
}

export interface LifecycleCompensationStep extends LifecycleStepBase {
  readonly compensatesStepId: string
  readonly kind: 'compensation'
}

export type LifecycleStep = LifecycleOperationStep | LifecycleCompensationStep

export interface LifecyclePlan {
  readonly id: string
  readonly intent: LifecycleIntent
  readonly kind: 'lifecycle-plan'
  readonly observation: LifecycleObservation
  readonly steps: readonly LifecycleStep[]
}

export type LifecycleVerification =
  | {
      readonly kind: 'satisfied'
      readonly observation: LifecycleObservation
      readonly postcondition: LifecyclePostcondition
    }
  | {
      readonly kind: 'unsatisfied'
      readonly observation: LifecycleObservation
      readonly postcondition: LifecyclePostcondition
      readonly reason: string
    }
  | {
      readonly kind: 'indeterminate'
      readonly observation?: LifecycleObservation
      readonly postcondition: LifecyclePostcondition
      readonly reason: string
    }

export interface LifecycleReceipt {
  readonly executableName?: string
  readonly executablePath?: string
  readonly kind: 'lifecycle-receipt'
  readonly providerId: string
  readonly providerTargetId: string
  readonly providerTargetKind?: 'binary' | 'cask' | 'formula' | 'id' | 'package' | 'script' | 'tool'
  readonly schemaVersion: number
  readonly targetId: string
  readonly verifiedAt: string
  readonly version?: string
}

export const LIFECYCLE_RECEIPT_SCHEMA_VERSION = 1

export type LifecycleOutcome<T> =
  | { readonly kind: 'success'; readonly value: T }
  | {
      readonly capability: ProviderCapability
      readonly kind: 'unsupported'
      readonly reason?: string
    }
  | {
      readonly kind: 'failed'
      readonly reason: string
      readonly retryable: boolean
    }
  | { readonly kind: 'cancelled'; readonly reason?: string }
  | { readonly kind: 'timed-out'; readonly timeoutMs: number }
  | { readonly kind: 'indeterminate'; readonly reason: string }
