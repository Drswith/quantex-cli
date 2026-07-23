import type { AgentDefinition } from '../agents'
import type {
  CoreInstallationCompatibilityExecutor,
  CoreInstallationCompatibilityRequest,
} from '../core/installation-compatibility'
import type {
  CoreInstallationExecutionOutcome,
  CoreInstallationExecutionValue,
  CoreMutationFailure,
} from '../core/installation-executor'
import type { CoreInvocationOutcome } from '../core/invocation'
import type { CoreAgentObservation } from '../core/production-observation'
import type { CommandError, CommandResult } from '../output/types'
import type { InstallationOperation } from './installation-routing'
import process from 'node:process'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'
import { resolveInstallMethodProviderBinding } from '../lifecycle/provider-binding'
import { createErrorResult, createSuccessResult, emitCommandEvent } from '../output'
import { buildInstalledAgentState } from '../package-manager'
import { resolveCliProviderOutputPolicy } from '../runtime/cli-operation-context'
import { resolveAgent } from '../services/agents'
import { getStateFilePath, StateFileError } from '../state'
import { StateSchemaError } from '../state/schema'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { createResourceLockedError, createStateReadError } from '../utils/lifecycle-errors'
import { isResourceLockError, type ResourceLockError } from '../utils/lock'

export interface CoreInstallationCommandData {
  agent: {
    displayName: string
    name: string
  }
  changed: boolean
  installState?: {
    installType: string
    packageName?: string
  }
  installed: boolean
}

export interface CoreInstallationCliSession {
  dispose(): void
  execute(
    name: string,
    options?: { readonly emitStartedEvent?: boolean },
  ): Promise<CommandResult<CoreInstallationCommandData>>
}

export interface CoreInstallationCliSessionOptions {
  readonly loadExecutor?: () => Promise<CoreInstallationCompatibilityExecutor>
}

export function createCoreInstallationCliSession(
  operation: InstallationOperation,
  options: CoreInstallationCliSessionOptions = {},
): CoreInstallationCliSession {
  const cliContext = getCliContext()
  const controller = new AbortController()
  const active = new Set<Promise<unknown>>()
  const loadExecutor = options.loadExecutor ?? loadProductionExecutor
  let disposed = false
  let executor: Promise<CoreInstallationCompatibilityExecutor> | undefined
  const getExecutor = (): Promise<CoreInstallationCompatibilityExecutor> => {
    executor ??= loadExecutor()
    return executor
  }

  if (cliContext.cancelled) controller.abort('cancelled')
  const unregisterCancellation = registerCliCancellationHandler(async () => {
    controller.abort('cancelled')
    await Promise.allSettled(active)
  })

  return {
    dispose(): void {
      if (disposed) return
      disposed = true
      unregisterCancellation()
    },
    async execute(name, executeOptions = {}): Promise<CommandResult<CoreInstallationCommandData>> {
      if (disposed) return createEngineUnavailableResult(operation, name)
      if (controller.signal.aborted) return createCancelledResult(operation, name)

      const execution = executeCoreInstallation(
        getExecutor,
        operation,
        name,
        controller.signal,
        executeOptions.emitStartedEvent ?? false,
      )
      active.add(execution)
      try {
        return await execution
      } finally {
        active.delete(execution)
      }
    },
  }
}

async function executeCoreInstallation(
  getExecutor: () => Promise<CoreInstallationCompatibilityExecutor>,
  operation: InstallationOperation,
  name: string,
  signal: AbortSignal,
  emitStartedEvent: boolean,
): Promise<CommandResult<CoreInstallationCommandData>> {
  try {
    const executor = await getExecutor()
    const cliContext = getCliContext()
    const request: CoreInstallationCompatibilityRequest = {
      mode: cliContext.dryRun ? 'preview' : 'apply',
      name,
      onMutationStart: emitStartedEvent ? event => emitInstallationStarted(operation, event.before.agent) : undefined,
      operation,
      outputPolicy: resolveCliProviderOutputPolicy(cliContext.outputMode),
      providerTimeoutMs: cliContext.timeoutMs,
      resolveAdoption: resolveCompatibilityAdoption,
      signal,
    }
    const outcome = await executor.execute(request)
    return projectCoreInstallationOutcome(operation, name, outcome)
  } catch (error) {
    reportCoreEngineFailure(operation, error)
    return projectUnexpectedCoreFailure(operation, name, error)
  }
}

export function projectCoreInstallationOutcome(
  operation: InstallationOperation,
  input: string,
  invocation: CoreInvocationOutcome<CoreInstallationExecutionOutcome>,
): CommandResult<CoreInstallationCommandData> {
  if (invocation.kind === 'failure') {
    if (invocation.error.code === 'cancelled') return createCancelledResult(operation, input)
    // Provider timeouts historically project as INSTALL_FAILED in the v1 CLI.
    // The outer command runtime remains the sole owner of the CLI TIMEOUT code.
    if (invocation.error.code === 'timed-out') return createInstallationFailedResult(operation, input)
    return createEngineUnavailableResult(operation, input)
  }

  const outcome = invocation.value
  if (outcome.kind === 'agent-not-found') {
    return createErrorResult({
      action: operation,
      error: {
        code: 'AGENT_NOT_FOUND',
        details: { input },
        message: `Unknown agent: ${input}`,
      },
      target: { kind: 'agent', name: input },
    })
  }
  if (outcome.kind === 'failed') return projectMutationFailure(operation, input, outcome.error)
  return projectMutationSuccess(operation, outcome.value)
}

async function resolveCompatibilityAdoption(before: CoreAgentObservation): Promise<
  | {
      readonly binding: NonNullable<ReturnType<typeof resolveInstallMethodProviderBinding>>
      readonly installedState: ReturnType<typeof buildInstalledAgentState>
    }
  | undefined
> {
  const method = getAdoptableExistingInstallMethod(
    [...before.methods],
    before.resolvedBinaryPath ?? before.pathExecutable.path,
  )
  if (!method) return undefined
  const binding = resolveInstallMethodProviderBinding(before.agent, method)
  if (!binding) return undefined
  return { binding, installedState: buildInstalledAgentState(before.agent, method) }
}

function projectMutationSuccess(
  operation: InstallationOperation,
  value: CoreInstallationExecutionValue,
): CommandResult<CoreInstallationCommandData> {
  const agent = value.before.agent
  if (value.decision === 'already-satisfied') return createAlreadyInstalledResult(operation, agent)

  if (value.decision === 'external-preserved') {
    if (!value.compatibility) return createUnmanagedResult(operation, agent)
    return value.kind === 'preview'
      ? createDryRunResult(operation, agent, 'adopt')
      : createTrackedExistingResult(operation, agent, value)
  }

  if (value.kind === 'preview') {
    return createDryRunResult(operation, agent, value.decision === 'reinstall' ? 'reinstall' : 'install')
  }

  const installedState = value.after.installedState
  if (!installedState) {
    return createErrorResult({
      action: operation,
      data: installationData(agent, false, false),
      error: verificationError(operation, agent),
      target: { kind: 'agent', name: agent.name },
    })
  }

  return createSuccessResult({
    action: operation,
    data: installationData(agent, true, true, installedState),
    target: { kind: 'agent', name: agent.name },
  })
}

function projectMutationFailure(
  operation: InstallationOperation,
  input: string,
  failure: CoreMutationFailure,
): CommandResult<CoreInstallationCommandData> {
  const lockError = findCause(failure.cause, asResourceLockError)
  if (lockError) {
    return createErrorResult({
      action: operation,
      ...createResourceLockedError(lockError, { kind: 'agent', name: input }),
    })
  }

  const stateError = failure.sideEffect === 'none' ? findCause(failure.cause, asStateFileError) : undefined
  if (stateError) {
    return createErrorResult({
      action: operation,
      ...createStateReadError(stateError, getStateFilePath(), { kind: 'agent', name: input }),
    })
  }

  const agent = resolveAgent(input)
  const effectiveCode = failure.code === 'compensation-failed' ? (failure.originCode ?? failure.code) : failure.code
  const error: CommandError =
    effectiveCode === 'recording-failed'
      ? {
          code: 'INSTALL_FAILED',
          details: { lifecycle: 'state-write-failed' },
          message: `Failed to record verified state for ${agent?.displayName ?? input}.`,
        }
      : effectiveCode === 'decision-conflict' ||
          effectiveCode === 'decision-indeterminate' ||
          effectiveCode === 'verification-failed'
        ? verificationError(operation, agent ?? fallbackAgent(input))
        : { code: 'INSTALL_FAILED', message: `Failed to install ${agent?.displayName ?? input}.` }

  return createErrorResult({
    action: operation,
    data: agent ? installationData(agent, false, false) : fallbackData(input),
    error,
    target: { kind: 'agent', name: agent?.name ?? input },
  })
}

function createAlreadyInstalledResult(
  operation: InstallationOperation,
  agent: AgentDefinition,
): CommandResult<CoreInstallationCommandData> {
  return createSuccessResult({
    action: operation,
    data: installationData(agent, false, true),
    target: { kind: 'agent', name: agent.name },
    warnings: [{ code: 'ALREADY_INSTALLED', message: `${agent.displayName} is already installed.` }],
  })
}

function createUnmanagedResult(
  operation: InstallationOperation,
  agent: AgentDefinition,
): CommandResult<CoreInstallationCommandData> {
  return createSuccessResult({
    action: operation,
    data: installationData(agent, false, true),
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'UNTRACKED_EXISTING_INSTALL',
        message: `${agent.displayName} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.`,
      },
    ],
  })
}

function createDryRunResult(
  operation: InstallationOperation,
  agent: AgentDefinition,
  route: 'adopt' | 'install' | 'reinstall',
): CommandResult<CoreInstallationCommandData> {
  return createSuccessResult({
    action: operation,
    data: installationData(agent, false, route === 'adopt'),
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'DRY_RUN',
        message:
          route === 'adopt'
            ? `Dry run: would record the existing ${agent.displayName} install in Quantex state.`
            : route === 'reinstall'
              ? `Dry run: would reinstall ${agent.displayName} only if its recorded provider target is confirmed absent.`
              : `Dry run: would install ${agent.displayName}.`,
      },
    ],
  })
}

function createTrackedExistingResult(
  operation: InstallationOperation,
  agent: AgentDefinition,
  value: Extract<CoreInstallationExecutionValue, { readonly kind: 'apply' }>,
): CommandResult<CoreInstallationCommandData> {
  const installedState = value.after.installedState
  if (!installedState) {
    return createErrorResult({
      action: operation,
      data: installationData(agent, false, true),
      error: verificationError(operation, agent),
      target: { kind: 'agent', name: agent.name },
    })
  }
  return createSuccessResult({
    action: operation,
    data: installationData(agent, value.changed, true, installedState),
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'TRACKED_EXISTING_INSTALL',
        message: `${agent.displayName} is already installed. Quantex is now tracking the existing install.`,
      },
    ],
  })
}

function createCancelledResult(
  operation: InstallationOperation,
  input: string,
): CommandResult<CoreInstallationCommandData> {
  return createErrorResult({
    action: operation,
    data: fallbackData(input),
    error: {
      code: 'CANCELLED',
      message: `${operation === 'ensure' ? 'Ensure' : 'Install'} was cancelled before tracking could complete.`,
    },
    target: { kind: 'agent', name: input },
  })
}

function createEngineUnavailableResult(
  operation: InstallationOperation,
  input: string,
): CommandResult<CoreInstallationCommandData> {
  return createErrorResult({
    action: operation,
    data: fallbackData(input),
    error: {
      code: 'INSTALL_FAILED',
      message: `Failed to initialize the ${operation} lifecycle engine.`,
    },
    target: { kind: 'agent', name: input },
  })
}

function createInstallationFailedResult(
  operation: InstallationOperation,
  input: string,
): CommandResult<CoreInstallationCommandData> {
  const agent = resolveAgent(input)
  return createErrorResult({
    action: operation,
    data: agent ? installationData(agent, false, false) : fallbackData(input),
    error: {
      code: 'INSTALL_FAILED',
      message: `Failed to install ${agent?.displayName ?? input}.`,
    },
    target: { kind: 'agent', name: agent?.name ?? input },
  })
}

function projectUnexpectedCoreFailure(
  operation: InstallationOperation,
  input: string,
  error: unknown,
): CommandResult<CoreInstallationCommandData> {
  const lockError = findCause(error, asResourceLockError)
  if (lockError) {
    return createErrorResult({
      action: operation,
      ...createResourceLockedError(lockError, { kind: 'agent', name: input }),
    })
  }
  const stateError = findCause(error, asStateFileError)
  if (stateError) {
    return createErrorResult({
      action: operation,
      ...createStateReadError(stateError, getStateFilePath(), { kind: 'agent', name: input }),
    })
  }
  return createEngineUnavailableResult(operation, input)
}

function installationData(
  agent: Pick<AgentDefinition, 'displayName' | 'name'>,
  changed: boolean,
  installed: boolean,
  state?: { readonly installType: string; readonly packageName?: string },
): CoreInstallationCommandData {
  return {
    agent: { displayName: agent.displayName, name: agent.name },
    changed,
    ...(state
      ? {
          installState: {
            installType: state.installType,
            ...(state.packageName === undefined ? {} : { packageName: state.packageName }),
          },
        }
      : {}),
    installed,
  }
}

function fallbackData(input: string): CoreInstallationCommandData {
  const agent = resolveAgent(input)
  return installationData(agent ?? fallbackAgent(input), false, false)
}

function fallbackAgent(input: string): Pick<AgentDefinition, 'displayName' | 'name'> {
  return { displayName: input, name: input }
}

function verificationError(
  operation: InstallationOperation,
  agent: Pick<AgentDefinition, 'displayName'>,
): CommandError {
  return {
    code: 'INSTALL_FAILED',
    details: { lifecycle: 'verification-failed' },
    message:
      operation === 'ensure'
        ? `${agent.displayName} could not be verified after ensure completed.`
        : `${agent.displayName} could not be verified after installation.`,
  }
}

function emitInstallationStarted(operation: InstallationOperation, agent: AgentDefinition): void {
  emitCommandEvent({
    action: operation,
    data: { agent: { displayName: agent.displayName, name: agent.name } },
    target: { kind: 'agent', name: agent.name },
    type: 'started',
  })
}

async function loadProductionExecutor(): Promise<CoreInstallationCompatibilityExecutor> {
  const compatibility = await import('../core/installation-compatibility')
  return compatibility.createCoreInstallationCompatibilityExecutor()
}

function reportCoreEngineFailure(operation: InstallationOperation, error: unknown): void {
  if (getCliContext().logLevel !== 'debug') return
  process.stderr.write(`[quantex:debug] ${operation} core engine failure: ${safeErrorReason(error)}\n`)
}

function safeErrorReason(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'unknown failure'
}

function asStateFileError(error: unknown): StateFileError | undefined {
  if (error instanceof StateFileError) return error
  if (error instanceof StateSchemaError) {
    return new StateFileError(`Failed to read Quantex state file: ${error.message}`, { cause: error })
  }
  if (isStatePathError(error)) return new StateFileError('Failed to read Quantex state file.', { cause: error })
  return undefined
}

function asResourceLockError(error: unknown): ResourceLockError | undefined {
  return isResourceLockError(error) ? error : undefined
}

function isStatePathError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'path' in error && String(error.path) === getStateFilePath())
}

function findCause<T>(error: unknown, match: (candidate: unknown) => T | false | undefined): T | undefined {
  const visited = new Set<unknown>()
  const pending: unknown[] = [error]
  while (pending.length > 0) {
    const candidate = pending.shift()
    if (candidate === undefined || candidate === null || visited.has(candidate)) continue
    visited.add(candidate)
    const matched = match(candidate)
    if (matched) return matched
    if (candidate instanceof AggregateError) pending.push(...candidate.errors)
    if (typeof candidate === 'object' && 'cause' in candidate) pending.push(candidate.cause)
  }
  return undefined
}
