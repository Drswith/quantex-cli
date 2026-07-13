import type {
  ProviderAvailability,
  ProviderId,
  ProviderOperation,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderRegistry,
} from '../providers'
import { firstPartyProviderRegistry } from '../providers'

const strictV1InstallerIds = Object.freeze([
  'brew',
  'bun',
  'cargo',
  'deno',
  'mise',
  'npm',
  'pip',
  'uv',
  'winget',
] as const)

type StrictV1InstallerId = (typeof strictV1InstallerIds)[number]
type StrictV1ProviderSnapshotEntry = ProviderSnapshotEntry & { readonly id: StrictV1InstallerId }

export interface ProviderSnapshotEntry {
  readonly availability: ProviderOutcome<ProviderAvailability>
  readonly capabilities: readonly ProviderOperation[]
  readonly id: ProviderId
}

export interface ObserveProviderSnapshotOptions {
  readonly context: ProviderOperationContext
  readonly registry?: ProviderRegistry
}

export async function observeProviderSnapshot(
  options: ObserveProviderSnapshotOptions,
): Promise<readonly ProviderSnapshotEntry[]> {
  const registry = options.registry ?? firstPartyProviderRegistry
  return Promise.all(
    registry.list().map(async adapter => ({
      availability: await observeAvailability(adapter.availability, options.context),
      capabilities: registry.getCapabilities(adapter.id),
      id: adapter.id,
    })),
  )
}

export function projectProviderSnapshotToV1Installers<T>(
  snapshot: readonly ProviderSnapshotEntry[],
  project: (entry: StrictV1ProviderSnapshotEntry) => T,
): Record<StrictV1InstallerId, T> {
  const byId = new Map(snapshot.map(entry => [entry.id, entry] as const))
  return Object.fromEntries(
    strictV1InstallerIds.map(id => {
      const entry = byId.get(id)
      if (!entry) throw new Error(`Provider snapshot is missing first-party adapter: ${id}`)
      return [id, project(entry as StrictV1ProviderSnapshotEntry)]
    }),
  ) as Record<StrictV1InstallerId, T>
}

async function observeAvailability(
  availability: (context: ProviderOperationContext) => Promise<ProviderOutcome<ProviderAvailability>>,
  context: ProviderOperationContext,
): Promise<ProviderOutcome<ProviderAvailability>> {
  try {
    return await availability(context)
  } catch (error) {
    return {
      kind: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      retryable: false,
    }
  }
}
