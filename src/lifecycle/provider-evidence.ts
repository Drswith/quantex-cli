import type { ProviderObservation, ProviderOutcome, ProviderRegistry } from '../providers'
import type { LifecycleProviderBinding } from './provider-binding'
import { firstPartyProviderRegistry } from '../providers'

export type { CatalogProviderEvidence, LifecycleProviderBinding } from './provider-binding'
export {
  providerBindingsEqual,
  resolveCatalogProviderBindings,
  resolveCatalogProviderEvidence,
  resolveInstallMethodProviderBinding,
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
