import type { VersionedIdempotencyLoadResult } from './idempotency'
import type { CanonicalMutationRequest, CanonicalValue } from './idempotency/canonical'
import type { IdempotencyPostcondition, IdempotencyReceiptEvidence } from './idempotency/schema'
import type { CommandResult, CommandTarget } from './output/types'

function isDryRunIdempotencyResult(result: CommandResult): boolean {
  return result.warnings.some(warning => warning.code === 'DRY_RUN')
}
import process from 'node:process'
import { cancelCliContextOperations, getCliContext } from './cli-context'
import { loadVersionedIdempotencyRecord, saveVersionedIdempotencyRecord } from './idempotency'
import { fingerprintCanonicalValue } from './idempotency/canonical'
import { evaluateReplay, type ReplayLiveEvidence, type ReplayLiveValidation } from './idempotency/replay'
import { createErrorResult, emitCommandEvent, emitCommandResult } from './output'
import { maybeRenderSelfUpdateNotice } from './self/update-notice'
import { getStateFilePath, StateFileError } from './state'
import { isProcessInterruptionError } from './utils/child-process'
import { pc } from './utils/color'
import { createStateReadError } from './utils/lifecycle-errors'

export interface CommandIdempotencyPolicy<T> {
  readonly captureEvidence: (
    result: CommandResult<T>,
  ) =>
    | Promise<
        { readonly postcondition: IdempotencyPostcondition; readonly receipt: IdempotencyReceiptEvidence } | undefined
      >
    | { readonly postcondition: IdempotencyPostcondition; readonly receipt: IdempotencyReceiptEvidence }
    | undefined
  readonly request: CanonicalMutationRequest
  readonly resolvedPlan: Readonly<Record<string, CanonicalValue>>
  readonly validateLive: (evidence: ReplayLiveEvidence) => Promise<ReplayLiveValidation> | ReplayLiveValidation
}

export type CommandIdempotencyPolicyFactory<T> = () =>
  | Promise<CommandIdempotencyPolicy<T>>
  | CommandIdempotencyPolicy<T>

export interface ExecuteCommandOptions<T> {
  action: string
  idempotencyPolicy?: CommandIdempotencyPolicy<T> | CommandIdempotencyPolicyFactory<T>
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}

type ResolvedExecuteCommandOptions<T> = Omit<ExecuteCommandOptions<T>, 'idempotencyPolicy'> & {
  idempotencyPolicy?: CommandIdempotencyPolicy<T>
}

interface PreparedIdempotency<T> {
  readonly policy?: CommandIdempotencyPolicy<T>
  readonly replayedResult?: CommandResult<T>
}

export async function executeCommandWithRuntime<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  try {
    return await executeCommandWithRuntimeInternal(options)
  } catch (error) {
    if (error instanceof StateFileError) return resolveStateReadError(options, error)

    throw error
  }
}

async function executeCommandWithRuntimeInternal<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  return withSignalCancellation(options, () => executeCommandWithinDeadline(options))
}

async function executeCommandWithinDeadline<T>(options: ExecuteCommandOptions<T>): Promise<CommandResult<T>> {
  const timeoutMs = getCliContext().timeoutMs
  const deadline = { expired: false }
  let replayed = false
  let resolvedOptions: ResolvedExecuteCommandOptions<T> | undefined
  const runPrimaryWork = async (): Promise<CommandResult<T>> => {
    const prepared = await prepareIdempotency(options, () => deadline.expired)
    if (deadline.expired && timeoutMs !== undefined) return createTimeoutCancellationResult(options, timeoutMs)
    if (prepared.replayedResult) {
      replayed = true
      return prepared.replayedResult
    }

    resolvedOptions = {
      action: options.action,
      ...(prepared.policy ? { idempotencyPolicy: prepared.policy } : {}),
      run: options.run,
      ...(options.target ? { target: options.target } : {}),
    }
    if (getCliContext().cancelled) return createInterruptedPrimaryResult(options)
    return options.run()
  }

  const result =
    timeoutMs === undefined
      ? await runPrimaryWork()
      : await executePrimaryWorkWithTimeout(options, runPrimaryWork, timeoutMs, deadline)

  if (replayed || !resolvedOptions) return result
  return finalizeSuccessfulRun(resolvedOptions, result)
}

async function executePrimaryWorkWithTimeout<T>(
  options: ExecuteCommandOptions<T>,
  run: () => Promise<CommandResult<T>>,
  timeoutMs: number,
  deadline: { expired: boolean },
): Promise<CommandResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timeoutPromise = new Promise<CommandResult<T>>(resolve => {
      timeoutId = setTimeout(() => {
        deadline.expired = true
        resolve(createTimeoutCancellationResult(options, timeoutMs))
      }, timeoutMs)
    })

    const runPromise = runUntilTimeoutCancellation(run, () => timeoutPromise)
    let result = await Promise.race([runPromise, timeoutPromise])

    if (!result.ok && result.error?.code === 'TIMEOUT') {
      const lateResult = await waitForLateTerminalCompletion(runPromise, timeoutMs)
      result =
        lateResult && lateResult.error?.code !== 'TIMEOUT'
          ? lateResult
          : await emitTimeoutCancellation(options, timeoutMs)
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    return result
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function prepareIdempotency<T>(
  options: ExecuteCommandOptions<T>,
  isDeadlineExpired: () => boolean = () => false,
): Promise<PreparedIdempotency<T>> {
  const context = getCliContext()
  if (!context.idempotencyKey || context.dryRun || !isMutationAction(options.action)) return {}

  if (!options.idempotencyPolicy) return {}

  const loaded = await loadVersionedIdempotencyRecord(context.idempotencyKey)
  if (context.cancelled || isDeadlineExpired()) return {}
  if (loaded.kind === 'invalid') {
    return {
      replayedResult: emitCommandResult(
        createPolicyInvalidEvidenceResult(options, context.idempotencyKey, loaded.reason),
        renderTimeoutHuman,
        { force: true },
      ),
    }
  }

  const policy =
    typeof options.idempotencyPolicy === 'function' ? await options.idempotencyPolicy() : options.idempotencyPolicy
  if (context.cancelled || isDeadlineExpired()) return {}

  const decision = await evaluateReplay({
    loaded,
    request: policy.request,
    resolvedPlan: policy.resolvedPlan,
    validateLive: policy.validateLive,
  })
  if (context.cancelled || isDeadlineExpired()) return {}

  if (decision.kind === 'reconcile') return { policy }
  if (decision.kind === 'reject') {
    return {
      replayedResult: emitPolicyRejection(options, context.idempotencyKey, decision, loaded),
    }
  }

  const replayedResult = withFreshReplayMetadata(decision.result) as CommandResult<T>
  emitCommandResult(replayedResult, renderTimeoutHuman, { force: true })
  return { replayedResult }
}

function createInterruptedPrimaryResult<T>(options: ExecuteCommandOptions<T>): CommandResult<T> {
  return createErrorResult<T>({
    action: options.action,
    error: { code: 'CANCELLED', message: 'Command was cancelled before execution could start.' },
    target: options.target,
  })
}

async function resolveStateReadError<T>(
  options: ExecuteCommandOptions<T>,
  error: StateFileError,
): Promise<CommandResult<T>> {
  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      ...createStateReadError(error, getStateFilePath(), options.target),
    }),
    renderStateReadHuman,
  )
}

function renderStateReadHuman(result: Pick<CommandResult, 'error'>): void {
  if (result.error) console.error(pc.red(result.error.message))
}

async function finalizeSuccessfulRun<T>(
  options: ResolvedExecuteCommandOptions<T>,
  result: CommandResult<T>,
): Promise<CommandResult<T>> {
  if (getCliContext().cancelled) return result

  const storedResult = await storeIdempotentResult(options, result)

  try {
    await maybeRenderSelfUpdateNotice({
      action: options.action,
      ok: storedResult.ok,
    })
  } catch {
    // Passive reminders must never fail the primary command path.
  }

  return storedResult
}

function renderTimeoutHuman(result: Pick<CommandResult, 'error'>): void {
  if (result.error) console.error(pc.red(result.error.message))
}

async function storeIdempotentResult<T>(
  options: ResolvedExecuteCommandOptions<T>,
  result: CommandResult<T>,
): Promise<CommandResult<T>> {
  const context = getCliContext()
  if (
    !context.idempotencyKey ||
    !isMutationAction(options.action) ||
    !result.ok ||
    context.dryRun ||
    isDryRunIdempotencyResult(result)
  )
    return result

  if (!options.idempotencyPolicy) return result

  const captured = await options.idempotencyPolicy.captureEvidence(result)
  if (!captured) return result
  const loaded = await loadVersionedIdempotencyRecord(context.idempotencyKey)
  const replacementRejection = rejectUnsafeReplacement(options, context.idempotencyKey, loaded)
  if (replacementRejection) return replacementRejection

  await saveVersionedIdempotencyRecord(context.idempotencyKey, {
    postcondition: fingerprinted(captured.postcondition),
    receipt: fingerprinted(captured.receipt),
    request: fingerprinted(options.idempotencyPolicy.request),
    resolvedPlan: fingerprinted(options.idempotencyPolicy.resolvedPlan),
    result,
  })

  return result
}

function rejectUnsafeReplacement<T>(
  options: ResolvedExecuteCommandOptions<T>,
  idempotencyKey: string,
  loaded: VersionedIdempotencyLoadResult,
): CommandResult<T> | undefined {
  if (!options.idempotencyPolicy) return undefined
  const requestedRequestFingerprint = fingerprintCanonicalValue(options.idempotencyPolicy.request)

  if (loaded.kind === 'invalid') {
    return emitCommandResult(
      createPolicyInvalidEvidenceResult(options, idempotencyKey, loaded.reason),
      renderTimeoutHuman,
      { force: true },
    )
  }
  if (loaded.kind !== 'valid' || loaded.record.request.fingerprint === requestedRequestFingerprint) return undefined

  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      error: {
        code: 'INVALID_ARGUMENT',
        details: {
          conflict: 'concurrent-request-mismatch',
          existingAction: loaded.record.request.payload.action,
          idempotencyKey,
        },
        message: `Idempotency key ${idempotencyKey} changed while the command was running; replay evidence was not overwritten.`,
      },
      target: options.target,
    }),
    renderTimeoutHuman,
    { force: true },
  )
}

function emitPolicyRejection<T>(
  options: ExecuteCommandOptions<T>,
  idempotencyKey: string,
  decision: Extract<Awaited<ReturnType<typeof evaluateReplay>>, { kind: 'reject' }>,
  loaded: VersionedIdempotencyLoadResult,
): CommandResult<T> {
  if (decision.reason === 'invalid-evidence') {
    return emitCommandResult(
      createPolicyInvalidEvidenceResult(options, idempotencyKey, decision.invalidReason),
      renderTimeoutHuman,
      { force: true },
    )
  }

  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      error: {
        code: 'INVALID_ARGUMENT',
        details: {
          existingAction: loaded.kind === 'valid' ? loaded.record.request.payload.action : undefined,
          idempotencyKey,
          reason: 'request-mismatch',
        },
        message: `Idempotency key ${idempotencyKey} was already used for a different canonical request.`,
      },
      target: options.target,
    }),
    renderTimeoutHuman,
    { force: true },
  )
}

function createPolicyInvalidEvidenceResult<T>(
  options: ExecuteCommandOptions<T>,
  idempotencyKey: string,
  invalidReason: Extract<VersionedIdempotencyLoadResult, { kind: 'invalid' }>['reason'],
): CommandResult<T> {
  return createErrorResult<T>({
    action: options.action,
    error: {
      code: 'INVALID_ARGUMENT',
      details: {
        idempotencyKey,
        invalidReason,
        reason: 'invalid-evidence',
      },
      message: `Idempotency key ${idempotencyKey} contains invalid replay evidence (${invalidReason}).`,
    },
    target: options.target,
  })
}

function withFreshReplayMetadata(result: CommandResult): CommandResult {
  const context = getCliContext()
  return {
    ...result,
    meta: {
      ...result.meta,
      mode: context.outputMode,
      runId: context.runId,
      timestamp: new Date().toISOString(),
    },
  }
}

function fingerprinted<T>(payload: T) {
  return { fingerprint: fingerprintCanonicalValue(payload), payload }
}

function isMutationAction(action: string): boolean {
  return action === 'ensure' || action === 'install' || action === 'uninstall' || action === 'update'
}

async function withSignalCancellation<T>(
  options: ExecuteCommandOptions<T>,
  run: () => Promise<CommandResult<T>>,
): Promise<CommandResult<T>> {
  let signalResultPromise: Promise<CommandResult<T>> | undefined
  let cleanup: (() => void) | undefined

  try {
    const signalPromise = new Promise<CommandResult<T>>(resolve => {
      const handleSignal = (signal: NodeJS.Signals): void => {
        signalResultPromise ??= resolveSignalCancellation(options, signal)
        void signalResultPromise.then(resolve)
      }

      const sigintHandler = (): void => handleSignal('SIGINT')
      const sigtermHandler = (): void => handleSignal('SIGTERM')
      process.once('SIGINT', sigintHandler)
      process.once('SIGTERM', sigtermHandler)
      cleanup = (): void => {
        process.off('SIGINT', sigintHandler)
        process.off('SIGTERM', sigtermHandler)
      }
    })

    return await Promise.race([runUntilSignalCancellation(run, () => signalResultPromise), signalPromise])
  } finally {
    cleanup?.()
  }
}

async function waitForLateTerminalCompletion<T>(
  runPromise: Promise<CommandResult<T>>,
  timeoutMs: number,
): Promise<CommandResult<T> | undefined> {
  const graceMs = Math.min(timeoutMs, 250)
  const runResult = await Promise.race([
    runPromise,
    new Promise<undefined>(resolve => {
      setTimeout(() => resolve(undefined), graceMs)
    }),
  ])

  return runResult
}

async function runUntilTimeoutCancellation<T>(
  run: () => Promise<CommandResult<T>>,
  getTimeoutResult: () => Promise<CommandResult<T>>,
): Promise<CommandResult<T>> {
  try {
    return await run()
  } catch (error) {
    if (isProcessInterruptionError(error) && error.kind === 'timed-out') return getTimeoutResult()
    if (getCliContext().cancelled) return getTimeoutResult()
    throw error
  }
}

async function runUntilSignalCancellation<T>(
  run: () => Promise<CommandResult<T>>,
  getSignalResult: () => Promise<CommandResult<T>> | undefined,
): Promise<CommandResult<T>> {
  try {
    const result = await run()
    const signalResult = getSignalResult()
    if (getCliContext().cancelled && signalResult) return signalResult
    return result
  } catch (error) {
    const signalResult = getSignalResult()
    if (getCliContext().cancelled && signalResult) return signalResult
    throw error
  }
}

function createTimeoutCancellationResult<T>(options: ExecuteCommandOptions<T>, timeoutMs: number): CommandResult<T> {
  return createErrorResult<T>({
    action: options.action,
    error: {
      code: 'TIMEOUT',
      details: {
        timeoutMs,
      },
      message: `Command timed out after ${timeoutMs}ms.`,
    },
    target: options.target,
  })
}

async function emitTimeoutCancellation<T>(
  options: ExecuteCommandOptions<T>,
  timeoutMs: number,
): Promise<CommandResult<T>> {
  await cancelCliContextOperations()
  emitCommandEvent(
    {
      action: options.action,
      data: {
        reason: 'timeout',
        timeoutMs,
      },
      target: options.target,
      type: 'cancelled',
    },
    { force: true },
  )

  return emitCommandResult(createTimeoutCancellationResult(options, timeoutMs), renderTimeoutHuman, { force: true })
}

async function resolveSignalCancellation<T>(
  options: ExecuteCommandOptions<T>,
  signal: NodeJS.Signals,
): Promise<CommandResult<T>> {
  await cancelCliContextOperations()
  emitCommandEvent(
    {
      action: options.action,
      data: {
        reason: 'signal',
        signal,
      },
      target: options.target,
      type: 'cancelled',
    },
    { force: true },
  )

  return emitCommandResult(
    createErrorResult<T>({
      action: options.action,
      error: {
        code: 'CANCELLED',
        details: {
          signal,
        },
        message: `Command cancelled by ${signal}.`,
      },
      target: options.target,
    }),
    renderTimeoutHuman,
    { force: true },
  )
}
