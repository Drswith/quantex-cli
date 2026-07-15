import type { InstallMethod } from '../agents'
import type { OutputMode, ProcessPort, RuntimeFailure, RuntimeOutcome } from '../runtime'
import {
  type AgentExecutableObservation,
  type AgentExecutionInstallPolicy,
  type LifecycleObservation,
  type LifecycleOutcome,
  planAgentExecutionPreflight,
} from '../lifecycle'

export interface LifecycleExecutionObservedAgent {
  readonly agent: {
    readonly binaryName: string
    readonly displayName: string
    readonly name: string
  }
  readonly executable: AgentExecutableObservation
  readonly methods: readonly InstallMethod[]
  readonly observation: LifecycleObservation
}

export interface LifecycleExecutionServicePorts {
  readonly confirmInstall: (observed: LifecycleExecutionObservedAgent) => Promise<boolean>
  readonly dryRun: boolean
  readonly install: (agentName: string) => Promise<LifecycleOutcome<void>>
  readonly interactive: boolean
  readonly observe: (agentName: string) => Promise<RuntimeOutcome<LifecycleExecutionObservedAgent | undefined>>
  readonly onInstallStart?: (observed: LifecycleExecutionObservedAgent) => Promise<void> | void
  readonly outputMode: OutputMode
  readonly process: ProcessPort
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

  const argv = [observed.agent.binaryName, ...input.args]
  if (planned.decision === 'dry-run') {
    return { argv, kind: 'dry-run', observed, wouldInstall: !observed.executable.present }
  }

  if (planned.decision === 'prompt-install' && !(await ports.confirmInstall(observed))) {
    return { kind: 'install-declined', observed }
  }

  if (planned.decision === 'install-and-launch' || planned.decision === 'prompt-install') {
    await ports.onInstallStart?.(observed)
    const installed = await ports.install(observed.agent.name)
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
    argv,
    signal: ports.signal,
    stdio: ports.outputMode === 'human' ? ['inherit', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
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
