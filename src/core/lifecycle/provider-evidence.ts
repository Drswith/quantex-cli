// L2: Core-internal provider observation helper. Not a leftover pass-through —
// observeLifecycleProvider defaults to the first-party registry. Binding helpers
// remain re-exported for existing non-SDK import sites. Do not re-export from
// src/core/index.ts or packages/core. src/state MUST NOT import this module.
// L5 leftover scan: KEEP product-path hang here (do not restore src/lifecycle).
import type { ProviderObservation, ProviderOutcome, ProviderRegistry } from '../../providers'
import type { LifecycleProviderBinding } from './provider-binding'
import { firstPartyProviderRegistry } from '../../providers'

export type { CatalogProviderEvidence, LifecycleProviderBinding } from './provider-binding'
export {
  providerBindingsEqual,
  resolveCatalogProviderBindings,
  resolveCatalogProviderEvidence,
  resolveInstallMethodProviderBinding,
  resolvePersistedProviderBinding,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from './provider-binding'

export interface ObserveLifecycleProviderOptions {
  readonly registry?: ProviderRegistry
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export async function observeLifecycleProvider(
  binding: LifecycleProviderBinding,
  options: ObserveLifecycleProviderOptions,
): Promise<ProviderOutcome<ProviderObservation>> {
  const registry = options.registry ?? firstPartyProviderRegistry
  const adapter = registry.get(binding.providerId)
  if (!adapter) {
    return {
      kind: 'unavailable',
      reason: `Provider ${binding.providerId} is not registered.`,
      retryable: false,
    }
  }

  return adapter.observe({
    context: {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
    target: binding.target,
  })
}
