import type { FirstPartyProviderAdapterMap, ProviderAdapter, ProviderId, ProviderOperation } from './types'
import { firstPartyProviderIds } from './types'

const operationOrder = Object.freeze([
  'availability',
  'observe',
  'resolve-latest-version',
  'install',
  'update',
  'update-many',
  'uninstall',
  'verify',
] as const satisfies readonly ProviderOperation[])

const operationProperties = {
  availability: 'availability',
  install: 'install',
  observe: 'observe',
  'resolve-latest-version': 'resolveLatestVersion',
  uninstall: 'uninstall',
  update: 'update',
  'update-many': 'updateMany',
  verify: 'verify',
} as const satisfies Record<ProviderOperation, keyof ProviderAdapter>

export interface ProviderRegistry {
  get(id: ProviderId): ProviderAdapter | undefined
  getCapabilities(id: ProviderId): readonly ProviderOperation[]
  list(): readonly ProviderAdapter[]
}

export function createProviderRegistry(adapters: readonly ProviderAdapter[]): ProviderRegistry {
  const adaptersById = new Map<ProviderId, ProviderAdapter>()

  for (const adapter of adapters) {
    if (adaptersById.has(adapter.id)) {
      throw new Error(`Duplicate provider adapter id: ${adapter.id}`)
    }

    adaptersById.set(adapter.id, adapter)
  }

  const adapterList = Object.freeze([...adapters])
  const capabilitiesById = new Map(
    adapterList.map(adapter => [adapter.id, deriveProviderCapabilities(adapter)] as const),
  )

  return Object.freeze({
    get(id: ProviderId): ProviderAdapter | undefined {
      return adaptersById.get(id)
    },
    getCapabilities(id: ProviderId): readonly ProviderOperation[] {
      return capabilitiesById.get(id) ?? Object.freeze([])
    },
    list(): readonly ProviderAdapter[] {
      return adapterList
    },
  })
}

export function defineFirstPartyProviderRegistry(adapters: FirstPartyProviderAdapterMap): ProviderRegistry {
  const orderedAdapters = firstPartyProviderIds.map(id => {
    const adapter = adapters[id]
    if (adapter.id !== id) {
      throw new Error(`Provider registry key ${id} does not match adapter id ${adapter.id}`)
    }

    return adapter
  })

  return createProviderRegistry(orderedAdapters)
}

export function deriveProviderCapabilities(adapter: ProviderAdapter): readonly ProviderOperation[] {
  return Object.freeze(
    operationOrder.filter(operation => typeof adapter[operationProperties[operation]] === 'function'),
  )
}
