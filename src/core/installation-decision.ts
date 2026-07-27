import type { LifecycleProviderBinding } from '../lifecycle/provider-binding'
import type { CoreAgentObservation } from './production-observation'

export type CoreInstallationDecision = 'already-satisfied' | 'external-preserved' | 'install' | 'reinstall'

export type CoreInstallationDirective =
  | {
      readonly binding?: LifecycleProviderBinding
      readonly changed: false
      readonly decision: 'already-satisfied' | 'external-preserved'
      readonly kind: 'ready'
    }
  | {
      readonly decision: 'install'
      readonly kind: 'ready'
      readonly requiredBinding?: never
      readonly wouldChange: true
    }
  | {
      readonly decision: 'reinstall'
      readonly kind: 'ready'
      readonly requiredBinding: LifecycleProviderBinding
      readonly wouldChange: true
    }
  | {
      readonly code: 'conflict' | 'indeterminate'
      readonly kind: 'blocked'
      readonly reason: string
    }
  | {
      readonly kind: 'interrupted'
      readonly outcome:
        | { readonly kind: 'cancelled'; readonly reason?: string }
        | { readonly kind: 'timed-out'; readonly timeoutMs: number }
    }

/**
 * Reduce one fresh lifecycle observation to the only four decisions supported by
 * the public Core install/ensure contract. Provider selection and side effects
 * deliberately happen later, after this fail-closed ownership decision.
 */
export function decideCoreInstallation(observed: CoreAgentObservation): CoreInstallationDirective {
  const providerOutcome = observed.providerOutcome
  if (providerOutcome?.kind === 'cancelled' || providerOutcome?.kind === 'timed-out') {
    return { kind: 'interrupted', outcome: providerOutcome }
  }

  const observation = observed.observation
  if (observation.drift.kind === 'conflicting-source') {
    return {
      code: 'conflict',
      kind: 'blocked',
      reason: 'Live and recorded installation evidence conflict.',
    }
  }
  if (observation.kind === 'indeterminate' || observation.drift.kind === 'indeterminate') {
    return {
      code: 'indeterminate',
      kind: 'blocked',
      reason:
        observation.kind === 'indeterminate'
          ? observation.reason
          : observation.drift.kind === 'indeterminate'
            ? observation.drift.reason
            : 'Provider evidence is indeterminate.',
    }
  }

  if (observation.kind === 'present') {
    if (observation.drift.kind === 'untracked') {
      return {
        ...(observed.binding ? { binding: observed.binding } : {}),
        changed: false,
        decision: 'external-preserved',
        kind: 'ready',
      }
    }

    const binding = observed.persistedBinding ?? observed.binding
    if (!binding) {
      return {
        code: 'indeterminate',
        kind: 'blocked',
        reason: 'A present managed installation has no resolvable source evidence.',
      }
    }
    return {
      binding,
      changed: false,
      decision: 'already-satisfied',
      kind: 'ready',
    }
  }

  if (observation.drift.kind === 'recorded-absent') {
    if (!observed.persistedBinding) {
      return {
        code: 'indeterminate',
        kind: 'blocked',
        reason: 'Recorded installation evidence cannot be resolved to a supported source.',
      }
    }
    return {
      decision: 'reinstall',
      kind: 'ready',
      requiredBinding: observed.persistedBinding,
      wouldChange: true,
    }
  }

  return {
    decision: 'install',
    kind: 'ready',
    wouldChange: true,
  }
}
