import type { AgentDefinition, InstallMethod } from '../agents'
import type { AgentExecutableObservation, LifecycleObservation, LifecycleOutcome } from '../lifecycle'
import type { ProcessPort, ProcessStdio, RuntimeFailure, RuntimeOutcome } from '../runtime'
import type { InstalledAgentState } from '../state'

/**
 * In-repo Core agent execution engine (CLI-facing). Absent from the published
 * `quantex-core` public API — do not re-export from `src/core/index.ts`.
 */
export type AgentExecutionInstallPolicy = 'always' | 'if-missing' | 'never' | 'prompt'

export interface AgentExecutionPreflightInput {
  readonly dryRun: boolean
  readonly executable: AgentExecutableObservation
  readonly installPolicy: AgentExecutionInstallPolicy
  readonly interactive: boolean
  readonly observation: LifecycleObservation
}

export type AgentExecutionPreflightPlan =
  | { readonly decision: 'dry-run' | 'install-and-launch' | 'launch' | 'prompt-install' }
  | {
      readonly decision: 'reject'
      readonly errorCode: 'AGENT_NOT_INSTALLED' | 'INTERACTION_REQUIRED'
    }

/** Pure preflight for exec/shortcut install policy — owned by Core execution. */
export function planAgentExecutionPreflight(input: AgentExecutionPreflightInput): AgentExecutionPreflightPlan {
  if (input.executable.present) return { decision: input.dryRun ? 'dry-run' : 'launch' }
  if (input.installPolicy === 'never') return { decision: 'reject', errorCode: 'AGENT_NOT_INSTALLED' }
  if (input.installPolicy === 'prompt' && !input.interactive) {
    return { decision: 'reject', errorCode: 'INTERACTION_REQUIRED' }
  }
  if (input.dryRun) return { decision: 'dry-run' }
  return { decision: input.installPolicy === 'prompt' ? 'prompt-install' : 'install-and-launch' }
}

export interface LifecycleExecutionObservedAgent {
  readonly agent: AgentDefinition
  readonly executable: AgentExecutableObservation
  readonly installedState?: InstalledAgentState
  readonly methods: readonly InstallMethod[]
  readonly observation: LifecycleObservation
}

export interface LifecycleExecutionServicePorts {
  readonly confirmInstall: (observed: LifecycleExecutionObservedAgent) => Promise<boolean>
  readonly dryRun: boolean
  readonly install: (observed: LifecycleExecutionObservedAgent) => Promise<LifecycleOutcome<void>>
  readonly interactive: boolean
  readonly observe: (agentName: string) => Promise<RuntimeOutcome<LifecycleExecutionObservedAgent | undefined>>
  readonly onInstallStart?: (observed: LifecycleExecutionObservedAgent) => Promise<void> | void
  readonly process: ProcessPort
  /** CLI-owned process I/O policy applied at agent launch. */
  readonly stdio: readonly [ProcessStdio, ProcessStdio, ProcessStdio]
  readonly signal: AbortSignal
  readonly timeoutMs?: number
}

export interface ExecuteAgentLifecycleInput {
  readonly agentName: string
  readonly args: readonly string[]
  readonly installPolicy: AgentExecutionInstallPolicy
}

type ObservedExecutionOutcome = {
  readonly observed: LifecycleExecutionObservedAgent
}

export type AgentExecutionOutcome =
  | { readonly kind: 'not-found' }
  | ({ readonly kind: 'not-installed' } & ObservedExecutionOutcome)
  | ({ readonly kind: 'interaction-required' } & ObservedExecutionOutcome)
  | ({ readonly kind: 'install-declined' } & ObservedExecutionOutcome)
  | ({ readonly kind: 'install-failed'; readonly reason: string } & ObservedExecutionOutcome)
  | ({
      readonly argv: readonly string[]
      readonly kind: 'dry-run'
      readonly wouldInstall: boolean
    } & ObservedExecutionOutcome)
  | { readonly error: RuntimeFailure; readonly kind: 'observation-failed' }
  | ({ readonly kind: 'launch-failed'; readonly reason: string } & ObservedExecutionOutcome)
  | ({
      readonly kind: 'cancelled'
      readonly phase: 'install' | 'launch'
      readonly reason?: string
    } & ObservedExecutionOutcome)
  | ({
      readonly kind: 'timed-out'
      readonly phase: 'install' | 'launch'
      readonly reason?: string
      readonly timeoutMs: number
    } & ObservedExecutionOutcome)
  | ({
      readonly exitCode: number
      readonly kind: 'exited'
      readonly stderr?: Uint8Array
      readonly stdout?: Uint8Array
    } & ObservedExecutionOutcome)

export async function executeAgentLifecycle(
  input: ExecuteAgentLifecycleInput,
  ports: LifecycleExecutionServicePorts,
): Promise<AgentExecutionOutcome> {
  const initial = await ports.observe(input.agentName)
  if (initial.kind === 'failure') return { error: initial.error, kind: 'observation-failed' }
  if (!initial.value) return { kind: 'not-found' }

  let observed = initial.value
  const planned = planAgentExecutionPreflight({
    dryRun: ports.dryRun,
    executable: observed.executable,
    installPolicy: input.installPolicy,
    interactive: ports.interactive,
    observation: observed.observation,
  })

  if (planned.decision === 'reject') {
    return planned.errorCode === 'AGENT_NOT_INSTALLED'
      ? { kind: 'not-installed', observed }
      : { kind: 'interaction-required', observed }
  }

  // Launch the resolved path so an agent that lives outside the inherited PATH
  // actually starts instead of failing the spawn Quantex just reported as ready.
  // Read from `observed` at launch time: an install-and-launch run only learns
  // the path from the post-install refresh below.
  const buildArgv = () => [observed.executable.path ?? observed.agent.binaryName, ...input.args]
  if (planned.decision === 'dry-run') {
    return { argv: buildArgv(), kind: 'dry-run', observed, wouldInstall: !observed.executable.present }
  }

  if (planned.decision === 'prompt-install' && !(await ports.confirmInstall(observed))) {
    return { kind: 'install-declined', observed }
  }

  if (planned.decision === 'install-and-launch' || planned.decision === 'prompt-install') {
    await ports.onInstallStart?.(observed)
    const installed = await ports.install(observed)
    const installationFailure = mapInstallationFailure(installed, observed)
    if (installationFailure) return installationFailure

    const refreshed = await ports.observe(input.agentName)
    if (refreshed.kind === 'failure') return { error: refreshed.error, kind: 'observation-failed' }
    if (!refreshed.value) return { kind: 'install-failed', observed, reason: 'agent-missing-after-install' }
    observed = refreshed.value
    if (!observed.executable.present) {
      return { kind: 'install-failed', observed, reason: 'executable-absent-after-install' }
    }
  }

  const processOutcome = await ports.process.run({
    argv: buildArgv(),
    signal: ports.signal,
    stdio: ports.stdio,
    timeoutMs: ports.timeoutMs,
  })
  return mapProcessOutcome(processOutcome, observed, ports.timeoutMs)
}

function mapInstallationFailure(
  outcome: LifecycleOutcome<void>,
  observed: LifecycleExecutionObservedAgent,
): AgentExecutionOutcome | undefined {
  switch (outcome.kind) {
    case 'success':
      return undefined
    case 'cancelled':
      return { kind: 'cancelled', observed, phase: 'install', reason: outcome.reason }
    case 'timed-out':
      return { kind: 'timed-out', observed, phase: 'install', timeoutMs: outcome.timeoutMs }
    case 'failed':
    case 'indeterminate':
      return { kind: 'install-failed', observed, reason: outcome.reason }
    case 'unsupported':
      return {
        kind: 'install-failed',
        observed,
        reason: outcome.reason ?? `Missing installation capability: ${outcome.capability}`,
      }
  }
}

function mapProcessOutcome(
  outcome: RuntimeOutcome<{
    readonly exitCode: number | null
    readonly stderr?: Uint8Array
    readonly stdout?: Uint8Array
    readonly terminationSignal?: string
  }>,
  observed: LifecycleExecutionObservedAgent,
  timeoutMs: number | undefined,
): AgentExecutionOutcome {
  if (outcome.kind === 'failure') {
    if (outcome.error.kind === 'cancelled') {
      return { kind: 'cancelled', observed, phase: 'launch', reason: outcome.error.message }
    }
    if (outcome.error.kind === 'timed-out') {
      return { kind: 'timed-out', observed, phase: 'launch', reason: outcome.error.message, timeoutMs: timeoutMs ?? 0 }
    }
    return { kind: 'launch-failed', observed, reason: outcome.error.message }
  }

  if (outcome.value.exitCode === null) {
    const reason = outcome.value.terminationSignal
      ? `Agent terminated by ${outcome.value.terminationSignal}.`
      : 'Agent process exited without an exit code.'
    return { kind: 'launch-failed', observed, reason }
  }

  return {
    exitCode: outcome.value.exitCode,
    kind: 'exited',
    observed,
    stderr: outcome.value.stderr,
    stdout: outcome.value.stdout,
  }
}
