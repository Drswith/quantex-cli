import type { Platform } from '../agents/types'
import type { LifecycleReceipt } from '../lifecycle/model'
import type { ProviderRegistry } from '../providers/registry'
import type {
  ProviderMutationEvidence,
  ProviderOperation,
  ProviderOperationContext,
  ProviderOutcome,
  ProviderTarget,
  ProviderVerification,
} from '../providers/types'
import type { LifecycleStateStore } from '../state/store'
import type {
  CoreInstallationExecutorPorts,
  CoreInstallationRecipe,
  CoreInstallationStateRecord,
} from './installation-executor-types'
import type { CoreInvocationContext } from './invocation'
import type { CoreMutationRecipeCatalog } from './mutation-recipe-catalog'
import type { CoreAgentObservation, CoreReadPorts } from './production-observation'
import { isDeepStrictEqual } from 'node:util'
import { createFileLifecycleStateStore } from '../state/file-store'
import { LIFECYCLE_RECEIPT_SCHEMA_VERSION } from '../state/schema'
import { getPlatform } from '../utils/detect'
import { acquireResourceLockInConfigDir } from '../utils/lock'
import { resolveCoreInstallationRecipe } from './installation-recipe-resolver'
import { prepareCoreInstallationStateRecord } from './installation-state-record'
import { loadCoreMutationRecipeCatalog } from './mutation-recipe-catalog'
import { createProductionCoreReadPorts } from './production-observation'

type AcquireResourceLock = typeof acquireResourceLockInConfigDir

export interface CoreInstallationProductionDependencies {
  readonly acquireResourceLock?: AcquireResourceLock
  readonly clock?: () => string
  readonly configDir: string
  readonly platform?: Platform
  readonly providerRegistry: ProviderRegistry
  readonly readPorts?: CoreReadPorts
  readonly recipeCatalog: CoreMutationRecipeCatalog
  readonly stateStore?: LifecycleStateStore
}

export async function loadProductionCoreInstallationPorts(configDir: string): Promise<CoreInstallationExecutorPorts> {
  const [recipeCatalog, providers] = await Promise.all([
    loadCoreMutationRecipeCatalog(),
    import('../providers/first-party'),
  ])
  return createProductionCoreInstallationPorts({
    configDir,
    providerRegistry: providers.firstPartyProviderRegistry,
    recipeCatalog,
  })
}

export function createProductionCoreInstallationPorts(
  dependencies: CoreInstallationProductionDependencies,
): CoreInstallationExecutorPorts {
  const acquireLock = dependencies.acquireResourceLock ?? acquireResourceLockInConfigDir
  const clock = dependencies.clock ?? (() => new Date().toISOString())
  const platform = dependencies.platform ?? getPlatform()
  const registry = dependencies.providerRegistry
  const readPorts = dependencies.readPorts ?? createProductionCoreReadPorts({ providerRegistry: registry })
  const stateStore = dependencies.stateStore ?? createFileLifecycleStateStore(dependencies.configDir)

  return {
    compensate: (recipe, context) => compensateOwnedInstallation(registry, recipe, context),
    install: (recipe, context) => invokeMutation(registry, recipe, 'install', context),
    observe: (name, context) => readPorts.inspectAgent(name, { ...context, configDir: dependencies.configDir }),
    prepareRecord: ({ before, context, recipe, verified }) =>
      prepareVerifiedRecord({
        acquireLock,
        before,
        clock,
        configDir: dependencies.configDir,
        context,
        recipe,
        stateStore,
        verified,
      }),
    resolveRecipe: input =>
      resolveCoreInstallationRecipe({
        ...input,
        catalog: dependencies.recipeCatalog,
        platform,
        providerRegistry: registry,
      }),
    verify: (recipe, context) => verifyInstallation(registry, recipe, context),
    withMutationLock: (_name, context, run) =>
      withInvocationLock(
        acquireLock,
        dependencies.configDir,
        { resource: 'agent lifecycle', scope: ['agent-lifecycle'] },
        context,
        run,
      ),
  }
}

async function invokeMutation(
  registry: ProviderRegistry,
  recipe: CoreInstallationRecipe,
  operation: 'install',
  context: ProviderOperationContext,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  const adapter = registry.get(recipe.binding.providerId)
  const invoke = adapter?.[operation]
  if (!adapter || !invoke) return unsupported(operation, recipe)
  return await normalizeProviderRejection(() => invoke({ context, target: recipe.binding.target }), context, operation)
}

async function verifyInstallation(
  registry: ProviderRegistry,
  recipe: CoreInstallationRecipe,
  context: ProviderOperationContext,
): Promise<ProviderOutcome<ProviderVerification>> {
  const adapter = registry.get(recipe.binding.providerId)
  if (!adapter?.verify) return unsupported('verify', recipe)
  return await normalizeProviderRejection(
    () => adapter.verify!({ context, target: recipe.binding.target }),
    context,
    'verify',
  )
}

async function compensateOwnedInstallation(
  registry: ProviderRegistry,
  recipe: CoreInstallationRecipe,
  context: ProviderOperationContext,
): Promise<ProviderOutcome<ProviderMutationEvidence>> {
  if (recipe.compensation === 'manual') return unsupported('uninstall', recipe)
  const adapter = registry.get(recipe.binding.providerId)
  if (!adapter?.uninstall) return unsupported('uninstall', recipe)

  const removed = await normalizeProviderRejection(
    () => adapter.uninstall!({ context, target: recipe.binding.target }),
    context,
    'uninstall',
  )
  if (removed.kind !== 'success') return removed

  const observed = await normalizeProviderRejection(
    () => adapter.observe({ context, target: recipe.binding.target }),
    context,
    'observe',
  )
  if (
    observed.kind === 'success' &&
    observed.value.kind === 'absent' &&
    providerTargetsExactlyEqual(observed.value.target, recipe.binding.target)
  ) {
    return removed
  }
  return {
    kind: 'failed',
    reason: providerOutcomeReason(observed, 'Compensation did not verify the selected target as absent.'),
    remediation: 'Inspect and remove the selected provider target manually before retrying.',
    retryable: false,
  }
}

interface PrepareVerifiedRecordInput {
  readonly acquireLock: AcquireResourceLock
  readonly before: CoreAgentObservation
  readonly clock: () => string
  readonly configDir: string
  readonly context: CoreInvocationContext
  readonly recipe: CoreInstallationRecipe
  readonly stateStore: LifecycleStateStore
  readonly verified: CoreAgentObservation
}

async function prepareVerifiedRecord(input: PrepareVerifiedRecordInput): Promise<CoreInstallationStateRecord> {
  const receipt = createVerifiedReceipt(input.recipe, input.verified, input.clock)
  let stateLease: InvocationLockLease | undefined
  let record: CoreInstallationStateRecord | undefined
  record = await prepareCoreInstallationStateRecord(
    input.stateStore,
    input.recipe.installedState,
    receipt,
    async () => {
      stateLease = await acquireInvocationLock(
        input.acquireLock,
        input.configDir,
        { resource: 'state', scope: ['state'] },
        input.context,
      )
      try {
        assertAgentEvidenceUnchanged(await input.stateStore.loadDocument(), input.before)
        return stateLease.release
      } catch (error) {
        await stateLease.release()
        throw error
      }
    },
  )
  stateLease?.transferCleanup(() => record!.rollback())
  return record
}

function createVerifiedReceipt(
  recipe: CoreInstallationRecipe,
  verified: CoreAgentObservation,
  clock: () => string,
): LifecycleReceipt {
  const observation = verified.observation
  const executablePath =
    verified.resolvedBinaryPath ??
    (observation.kind === 'present' ? observation.executablePath : verified.executable.path)
  const version = observation.kind === 'present' ? observation.version : verified.executable.version
  return {
    ...(recipe.binding.target.binaryName ? { executableName: recipe.binding.target.binaryName } : {}),
    ...(executablePath ? { executablePath } : {}),
    kind: 'lifecycle-receipt',
    providerId: recipe.binding.providerId,
    providerTargetId: recipe.binding.target.id,
    providerTargetKind: recipe.binding.target.kind,
    schemaVersion: LIFECYCLE_RECEIPT_SCHEMA_VERSION,
    targetId: recipe.installedState.agentName,
    verifiedAt: observation.observedAt ?? clock(),
    ...(version ? { version } : {}),
  }
}

function assertAgentEvidenceUnchanged(
  current: Awaited<ReturnType<LifecycleStateStore['loadDocument']>>,
  before: CoreAgentObservation,
): void {
  const name = before.agent.name
  if (
    !isDeepStrictEqual(current.installedAgents[name], before.installedState) ||
    !isDeepStrictEqual(current.lifecycleReceipts[name], before.receipt)
  ) {
    throw new Error('Recorded agent evidence changed while the lifecycle mutation was in progress.')
  }
}

interface InvocationLockLease {
  readonly release: () => Promise<void>
  transferCleanup(cleanup: () => Promise<void>): void
}

async function acquireInvocationLock(
  acquireLock: AcquireResourceLock,
  configDir: string,
  options: Parameters<AcquireResourceLock>[1],
  context: CoreInvocationContext,
): Promise<InvocationLockLease> {
  const releaseLock = await acquireLock(configDir, options)
  let releasePromise: Promise<void> | undefined
  let cleanup = (): Promise<void> => releaseOnce()
  const releaseOnce = (): Promise<void> => {
    releasePromise ??= Promise.resolve().then(() => releaseLock())
    return releasePromise
  }
  const unregister = context.registerCleanup({
    cleanup: () => cleanup(),
    force: () => cleanup(),
  })
  const release = async (): Promise<void> => {
    unregister()
    await releaseOnce()
  }
  return {
    release,
    transferCleanup(next): void {
      cleanup = next
    },
  }
}

async function withInvocationLock<T>(
  acquireLock: AcquireResourceLock,
  configDir: string,
  options: Parameters<AcquireResourceLock>[1],
  context: CoreInvocationContext,
  run: () => Promise<T>,
): Promise<T> {
  const lease = await acquireInvocationLock(acquireLock, configDir, options, context)
  let settle!: () => void
  const settled = new Promise<void>(resolve => {
    settle = resolve
  })
  lease.transferCleanup(async () => {
    await settled
    await lease.release()
  })
  try {
    return await run()
  } finally {
    settle()
    await lease.release()
  }
}

async function normalizeProviderRejection<T>(
  invoke: () => Promise<ProviderOutcome<T>>,
  context: ProviderOperationContext,
  operation: ProviderOperation,
): Promise<ProviderOutcome<T>> {
  try {
    return await invoke()
  } catch (error) {
    if (context.signal.aborted) {
      return {
        kind: 'cancelled',
        ...(context.signal.reason === undefined ? {} : { reason: errorReason(context.signal.reason) }),
      }
    }
    const interruption = providerInterruption(error)
    if (interruption) return interruption
    return {
      kind: 'failed',
      reason: `${operation} provider rejected: ${errorReason(error)}`,
      retryable: false,
    }
  }
}

function unsupported<T>(operation: ProviderOperation, recipe: CoreInstallationRecipe): ProviderOutcome<T> {
  return {
    kind: 'unsupported',
    operation,
    reason: `Provider ${recipe.binding.providerId} does not support ${operation}.`,
  }
}

function providerInterruption(
  error: unknown,
): Extract<ProviderOutcome<never>, { kind: 'cancelled' | 'timed-out' }> | undefined {
  if (!error || typeof error !== 'object' || !('kind' in error)) return undefined
  if (error.kind === 'cancelled') {
    return {
      kind: 'cancelled',
      ...('reason' in error && error.reason !== undefined ? { reason: errorReason(error.reason) } : {}),
    }
  }
  if (error.kind === 'timed-out' && 'timeoutMs' in error && typeof error.timeoutMs === 'number') {
    return { kind: 'timed-out', timeoutMs: error.timeoutMs }
  }
  return undefined
}

function providerTargetsExactlyEqual(left: ProviderTarget, right: ProviderTarget): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.binaryName === right.binaryName &&
    stringArraysEqual(left.arguments, right.arguments)
  )
}

function stringArraysEqual(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  if (!left || !right) return left === right
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function providerOutcomeReason(outcome: ProviderOutcome<unknown>, fallback: string): string {
  return outcome.kind !== 'success' && 'reason' in outcome && outcome.reason ? outcome.reason : fallback
}

function errorReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'Core provider operation failed.'
}
