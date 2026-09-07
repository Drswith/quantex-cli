// KEEP (S3): Core self-upgrade engine (CLI-facing). Plan/check/apply over
// injected ports. Absent from published SDK. Not a leftover of src/self.
// S3 leftover scan: KEEP product-path hang here (Core-internal leftover; do not restore src/lifecycle).
import type {
  CachePort,
  InvocationContext,
  LockPort,
  NetworkPort,
  PersistencePort,
  ProcessPort,
  ProcessStdio,
  RuntimeFailure,
} from '../runtime'

/**
 * KEEP (P6 / P7): in-repo Core self-upgrade engine (CLI-facing). Absent from
 * the published `quantex-core` public API — do not re-export from `src/core/index.ts`.
 *
 * Owns plan/check/apply orchestration only. Domain inspection, providers,
 * binary replacement, and locks remain outside Core and are injected as ports.
 * This module MUST NOT import `src/self` (architecture boundary).
 */

type MetadataCacheMode = 'default' | 'no-cache' | 'refresh'

export type CoreSelfUpdateChannel = 'beta' | 'stable'

export interface CoreSelfUpgradeInput {
  readonly check: boolean
  readonly dryRun: boolean
  readonly updateChannel?: CoreSelfUpdateChannel
}

export interface CoreSelfUpgradePlanInput {
  readonly context: CoreSelfUpgradeOperationContext
  readonly metadataCache: CachePort
  readonly metadataCacheMode: MetadataCacheMode
  readonly networkPort: NetworkPort
  readonly persistencePort: PersistencePort
  readonly updateChannel?: CoreSelfUpdateChannel
}

export interface CoreSelfUpgradeOperationContext {
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export interface CoreSelfUpgradeExecutionInput {
  readonly lockPort: LockPort
  readonly networkPort: NetworkPort
  readonly processPort: ProcessPort
  readonly signal: AbortSignal
  readonly stdio: readonly [ProcessStdio, ProcessStdio, ProcessStdio]
  readonly timeoutMs?: number
}

export interface CoreSelfUpgradePlan {
  readonly status: 'check-unavailable' | 'manual-required' | 'up-to-date' | 'update-available'
}

export interface CoreSelfUpgradePorts<TPlan extends CoreSelfUpgradePlan = CoreSelfUpgradePlan, TResult = unknown> {
  plan(input: CoreSelfUpgradePlanInput): Promise<TPlan>
  upgrade(plan: TPlan, input: CoreSelfUpgradeExecutionInput): Promise<TResult>
}

export type CoreSelfUpgradeOutcome<TPlan extends CoreSelfUpgradePlan = CoreSelfUpgradePlan, TResult = unknown> =
  | { readonly kind: 'executed'; readonly plan: TPlan; readonly result: TResult }
  | { readonly kind: 'interrupted'; readonly error: RuntimeFailure; readonly plan?: TPlan }
  | { readonly kind: 'planned'; readonly plan: TPlan }

export async function executeCoreSelfUpgrade<TPlan extends CoreSelfUpgradePlan, TResult>(
  input: CoreSelfUpgradeInput,
  invocation: InvocationContext,
  ports: CoreSelfUpgradePorts<TPlan, TResult>,
): Promise<CoreSelfUpgradeOutcome<TPlan, TResult>> {
  if (invocation.signal.aborted) return interrupted()

  const plan = await ports.plan({
    context: {
      signal: invocation.signal,
      timeoutMs: invocation.options.timeoutMs,
    },
    metadataCache: invocation.ports.cache,
    metadataCacheMode: invocation.options.cacheMode === 'no-cache' ? 'no-cache' : 'refresh',
    networkPort: invocation.ports.network,
    persistencePort: invocation.ports.persistence,
    updateChannel: input.updateChannel,
  })

  if (invocation.signal.aborted) return interrupted(plan)
  if (input.check || input.dryRun || plan.status !== 'update-available') return { kind: 'planned', plan }

  const result = await ports.upgrade(plan, {
    lockPort: invocation.ports.locks,
    networkPort: invocation.ports.network,
    processPort: invocation.ports.process,
    signal: invocation.signal,
    stdio: invocation.options.outputMode === 'human' ? ['inherit', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
    timeoutMs: invocation.options.timeoutMs,
  })
  return { kind: 'executed', plan, result }
}

function interrupted<TPlan extends CoreSelfUpgradePlan, TResult>(plan?: TPlan): CoreSelfUpgradeOutcome<TPlan, TResult> {
  return {
    error: { kind: 'cancelled', message: 'Self-upgrade invocation was cancelled.' },
    kind: 'interrupted',
    ...(plan ? { plan } : {}),
  }
}
