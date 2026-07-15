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
import type { SelfUpdateChannel, SelfUpdateResult, SelfUpgradePlan } from './types'

export interface SelfUpgradeApplicationInput {
  readonly check: boolean
  readonly dryRun: boolean
  readonly updateChannel?: SelfUpdateChannel
}

export interface SelfUpgradeApplicationPlanInput {
  readonly context: SelfUpgradeOperationContext
  readonly metadataCache: CachePort
  readonly networkPort: NetworkPort
  readonly persistencePort: PersistencePort
  readonly updateChannel?: SelfUpdateChannel
}

export interface SelfUpgradeOperationContext {
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export interface SelfUpgradeApplicationExecutionInput {
  readonly lockPort: LockPort
  readonly networkPort: NetworkPort
  readonly processPort: ProcessPort
  readonly signal: AbortSignal
  readonly stdio: readonly [ProcessStdio, ProcessStdio, ProcessStdio]
  readonly timeoutMs?: number
}

export interface SelfUpgradeApplicationPorts {
  plan(input: SelfUpgradeApplicationPlanInput): Promise<SelfUpgradePlan>
  upgrade(plan: SelfUpgradePlan, input: SelfUpgradeApplicationExecutionInput): Promise<SelfUpdateResult>
}

export type SelfUpgradeApplicationOutcome =
  | { readonly kind: 'executed'; readonly plan: SelfUpgradePlan; readonly result: SelfUpdateResult }
  | { readonly kind: 'interrupted'; readonly error: RuntimeFailure; readonly plan?: SelfUpgradePlan }
  | { readonly kind: 'planned'; readonly plan: SelfUpgradePlan }

export async function runSelfUpgradeApplication(
  input: SelfUpgradeApplicationInput,
  invocation: InvocationContext,
  ports: SelfUpgradeApplicationPorts,
): Promise<SelfUpgradeApplicationOutcome> {
  if (invocation.signal.aborted) return interrupted()

  const plan = await ports.plan({
    context: {
      signal: invocation.signal,
      timeoutMs: invocation.options.timeoutMs,
    },
    metadataCache: invocation.ports.cache,
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

function interrupted(plan?: SelfUpgradePlan): SelfUpgradeApplicationOutcome {
  return {
    error: { kind: 'cancelled', message: 'Self-upgrade invocation was cancelled.' },
    kind: 'interrupted',
    ...(plan ? { plan } : {}),
  }
}
