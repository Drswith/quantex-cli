import type { AgentDefinition, Platform } from '../agents'
import type { ProviderOperation, ProviderOutcome, ProviderObservation, ProviderRegistry } from '../providers'
import type { InstalledAgentState } from '../state'
import type { LifecycleObservation, LifecycleReceipt } from './model'
import { compareVersions } from '../utils/version'
import {
  type LifecycleProviderBinding,
  observeLifecycleProvider,
  providerBindingsEqual,
  resolveCatalogProviderEvidence,
  resolveReceiptProviderBinding,
  resolveStateProviderBinding,
} from './provider-evidence'

export interface AgentExecutableObservation {
  readonly path?: string
  readonly present: boolean
  readonly version?: string
}

export interface AgentLifecycleObservationPorts {
  readonly clock: () => string
  readonly inspectExecutable: (agent: AgentDefinition) => Promise<AgentExecutableObservation>
  readonly platform: Platform
  readonly preferredCatalogBinding?: LifecycleProviderBinding
  readonly providerRegistry: ProviderRegistry
  readonly readInstalledState: (agentName: string) => Promise<InstalledAgentState | undefined>
  readonly readReceipt: (agentName: string) => Promise<LifecycleReceipt | undefined>
  readonly signal: AbortSignal
  readonly timeoutMs?: number
  readonly observeProvider?: (
    binding: LifecycleProviderBinding,
    options: {
      readonly registry: ProviderRegistry
      readonly signal: AbortSignal
      readonly timeoutMs?: number
    },
  ) => Promise<ProviderOutcome<ProviderObservation>>
}

export interface AgentLifecycleObservationResult {
  readonly binding?: LifecycleProviderBinding
  readonly capabilities: readonly ProviderOperation[]
  readonly catalogMethods: readonly LifecycleProviderBinding[]
  readonly executable: AgentExecutableObservation
  readonly installedState?: InstalledAgentState
  readonly observation: LifecycleObservation
  readonly pathExecutable: AgentExecutableObservation
  readonly persistedBinding?: LifecycleProviderBinding
  readonly providerOutcome?: ProviderOutcome<ProviderObservation>
  readonly receipt?: LifecycleReceipt
}

export async function observeAgentLifecycle(
  agent: AgentDefinition,
  ports: AgentLifecycleObservationPorts,
): Promise<AgentLifecycleObservationResult> {
  const [executable, installedState, receipt] = await Promise.all([
    ports.inspectExecutable(agent),
    ports.readInstalledState(agent.name),
    ports.readReceipt(agent.name),
  ])
  const observedAt = ports.clock()
  const catalogEvidence = resolveCatalogProviderEvidence(agent, ports.platform)
  const catalogMethods = catalogEvidence.bindings
  const stateBinding = installedState ? resolveStateProviderBinding(agent, installedState) : undefined
  const receiptBinding = receipt ? resolveReceiptProviderBinding(receipt) : undefined
  const persistedBinding = receiptBinding ?? stateBinding
  const base = { catalogMethods, executable, installedState, pathExecutable: executable, persistedBinding, receipt }

  if ((installedState && !stateBinding) || (receipt && !receiptBinding)) {
    return {
      ...base,
      capabilities: [],
      observation: indeterminateObservation(agent, observedAt, 'Persisted provider binding cannot be resolved.'),
    }
  }

  if (stateBinding && receiptBinding && !providerBindingsEqual(stateBinding, receiptBinding, agent.binaryName)) {
    return {
      ...base,
      capabilities: [],
      observation: executable.present
        ? presentObservation(agent, executable, observedAt, {
            kind: 'conflicting-source',
            observedProviderId: stateBinding.providerId,
            recordedProviderId: receiptBinding.providerId,
          })
        : {
            drift: {
              kind: 'conflicting-source',
              observedProviderId: stateBinding.providerId,
              recordedProviderId: receiptBinding.providerId,
            },
            kind: 'absent',
            observedAt,
            targetId: agent.name,
          },
    }
  }

  const recordedBinding = persistedBinding
  if (recordedBinding) {
    const providerOutcome = await observeProvider(recordedBinding, ports)
    const capabilities = ports.providerRegistry.getCapabilities(recordedBinding.providerId)
    if (providerOutcome.kind !== 'success') {
      return {
        ...base,
        binding: recordedBinding,
        capabilities,
        observation: indeterminateObservation(agent, observedAt, providerOutcomeReason(providerOutcome)),
        providerOutcome,
      }
    }

    const providerObservation = providerOutcome.value
    if (!providerTargetMatches(recordedBinding, providerObservation)) {
      return {
        ...base,
        binding: recordedBinding,
        capabilities,
        observation: conflictingProviderTargetObservation(agent, executable, observedAt),
        providerOutcome,
      }
    }
    if (providerObservation.kind === 'absent' && !executable.present) {
      return {
        ...base,
        binding: recordedBinding,
        capabilities,
        observation: {
          drift: { kind: 'recorded-absent' },
          kind: 'absent',
          observedAt,
          targetId: agent.name,
        },
        providerOutcome,
      }
    }

    const evidenceConflicts =
      providerObservation.kind !== (executable.present ? 'present' : 'absent') ||
      (providerObservation.kind === 'present' &&
        executable.present &&
        providerObservation.executablePath !== undefined &&
        executable.path !== undefined &&
        providerObservation.executablePath !== executable.path) ||
      (providerObservation.kind === 'present' && versionsConflict(providerObservation.version, executable.version)) ||
      (receipt?.executablePath !== undefined &&
        executable.path !== undefined &&
        receipt.executablePath !== executable.path) ||
      executableIdentityConflicts(agent, installedState, receipt, recordedBinding)
    const liveExecutable = mergeExecutableObservation(executable, providerObservation)

    return {
      ...base,
      binding: recordedBinding,
      capabilities,
      executable: liveExecutable,
      observation: presentObservation(
        agent,
        liveExecutable,
        observedAt,
        evidenceConflicts
          ? {
              kind: 'conflicting-source',
              observedProviderId: providerObservation.kind === 'present' ? recordedBinding.providerId : undefined,
              recordedProviderId: recordedBinding.providerId,
            }
          : { kind: 'none' },
        providerObservation.kind === 'present' ? recordedBinding : undefined,
      ),
      providerOutcome,
    }
  }

  const candidateOutcomes = await Promise.all(
    catalogMethods.map(async binding => ({ binding, outcome: await observeProvider(binding, ports) })),
  )
  const mismatchedCandidate = candidateOutcomes.find(
    candidate =>
      candidate.outcome.kind === 'success' && !providerTargetMatches(candidate.binding, candidate.outcome.value),
  )
  if (mismatchedCandidate) {
    return {
      ...base,
      capabilities: [],
      observation: conflictingProviderTargetObservation(agent, executable, observedAt),
      providerOutcome: mismatchedCandidate.outcome,
    }
  }

  const liveCandidates = candidateOutcomes.filter(
    (
      candidate,
    ): candidate is typeof candidate & {
      outcome: { kind: 'success'; value: Extract<ProviderObservation, { kind: 'present' }> }
    } => candidate.outcome.kind === 'success' && candidate.outcome.value.kind === 'present',
  )
  const exactProviderCandidates = candidateOutcomes.filter(
    candidate => candidate.binding.providerId !== 'binary' && candidate.binding.providerId !== 'script',
  )
  const exactOwnershipCandidates = exactProviderCandidates.filter(
    (
      candidate,
    ): candidate is typeof candidate & {
      outcome: { kind: 'success'; value: Extract<ProviderObservation, { kind: 'present' }> }
    } => candidate.outcome.kind === 'success' && candidate.outcome.value.kind === 'present',
  )
  const exactProviderUnresolved = exactProviderCandidates.some(candidate => candidate.outcome.kind !== 'success')
  const authoritativeLiveCandidates =
    exactOwnershipCandidates.length > 0 ? exactOwnershipCandidates : exactProviderUnresolved ? [] : liveCandidates
  if (authoritativeLiveCandidates.length > 1) {
    return {
      ...base,
      capabilities: [],
      observation: executable.present
        ? presentObservation(agent, executable, observedAt, { kind: 'conflicting-source' })
        : {
            drift: { kind: 'conflicting-source' },
            kind: 'indeterminate',
            observedAt,
            reason: 'Multiple catalog providers report the agent as present.',
            targetId: agent.name,
          },
    }
  }

  if (catalogEvidence.unresolvedCandidates.length > 0) {
    return {
      ...base,
      capabilities: [],
      observation: indeterminateObservation(agent, observedAt, 'A catalog provider binding cannot be resolved.'),
    }
  }

  const unresolvedOutcome = candidateOutcomes.map(candidate => candidate.outcome).find(isNonSuccessProviderOutcome)
  const interruptedOutcome = candidateOutcomes
    .map(candidate => candidate.outcome)
    .find(outcome => outcome.kind === 'cancelled' || outcome.kind === 'timed-out')
  if (interruptedOutcome) {
    return {
      ...base,
      capabilities: [],
      observation: indeterminateObservation(agent, observedAt, providerOutcomeReason(interruptedOutcome)),
      providerOutcome: interruptedOutcome,
    }
  }

  const liveCandidate = authoritativeLiveCandidates[0]
  if (liveCandidate) {
    const binding = liveCandidate.binding
    const providerObservation = liveCandidate.outcome.value
    const liveExecutable = mergeExecutableObservation(executable, providerObservation)
    const evidenceConflicts =
      !executable.present ||
      (providerObservation.executablePath !== undefined &&
        executable.path !== undefined &&
        providerObservation.executablePath !== executable.path) ||
      versionsConflict(providerObservation.version, executable.version)
    return {
      ...base,
      binding,
      capabilities: ports.providerRegistry.getCapabilities(binding.providerId),
      executable: liveExecutable,
      observation: presentObservation(
        agent,
        liveExecutable,
        observedAt,
        evidenceConflicts
          ? { kind: 'conflicting-source', observedProviderId: binding.providerId }
          : { kind: 'untracked' },
        binding,
      ),
      providerOutcome: liveCandidate.outcome,
    }
  }

  const preferredCatalogBinding = ports.preferredCatalogBinding
  const absentCandidate = preferredCatalogBinding
    ? candidateOutcomes.find(
        candidate =>
          providerBindingsEqual(candidate.binding, preferredCatalogBinding, agent.binaryName) &&
          candidate.outcome.kind === 'success' &&
          candidate.outcome.value.kind === 'absent',
      )
    : undefined
  if (!executable.present && liveCandidates.length === 0 && unresolvedOutcome && absentCandidate) {
    return {
      ...base,
      capabilities: [],
      observation: { drift: { kind: 'none' }, kind: 'absent', observedAt, targetId: agent.name },
      providerOutcome: absentCandidate.outcome,
    }
  }

  if (unresolvedOutcome) {
    return {
      ...base,
      capabilities: [],
      observation: indeterminateObservation(agent, observedAt, providerOutcomeReason(unresolvedOutcome)),
      providerOutcome: unresolvedOutcome,
    }
  }

  return {
    ...base,
    capabilities: [],
    observation: executable.present
      ? presentObservation(agent, executable, observedAt, { kind: 'untracked' })
      : { drift: { kind: 'none' }, kind: 'absent', observedAt, targetId: agent.name },
  }
}

async function observeProvider(
  binding: LifecycleProviderBinding,
  ports: AgentLifecycleObservationPorts,
): Promise<ProviderOutcome<ProviderObservation>> {
  try {
    return await (ports.observeProvider ?? observeLifecycleProvider)(binding, {
      registry: ports.providerRegistry,
      signal: ports.signal,
      timeoutMs: ports.timeoutMs,
    })
  } catch (error) {
    return {
      kind: 'failed',
      reason: safeProviderRejectionReason(error),
      retryable: false,
    }
  }
}

function presentObservation(
  agent: AgentDefinition,
  executable: AgentExecutableObservation,
  observedAt: string,
  drift: LifecycleObservation['drift'],
  binding?: LifecycleProviderBinding,
): LifecycleObservation {
  return {
    drift,
    ...(executable.path ? { executablePath: executable.path } : {}),
    kind: 'present',
    observedAt,
    ...(binding
      ? {
          providerId: binding.providerId,
          providerTargetId: binding.target.id,
          providerTargetKind: binding.target.kind,
        }
      : {}),
    targetId: agent.name,
    ...(executable.version ? { version: executable.version } : {}),
  }
}

function indeterminateObservation(agent: AgentDefinition, observedAt: string, reason: string): LifecycleObservation {
  return {
    drift: { kind: 'indeterminate', reason },
    kind: 'indeterminate',
    observedAt,
    reason,
    targetId: agent.name,
  }
}

function mergeExecutableObservation(
  executable: AgentExecutableObservation,
  providerObservation: ProviderObservation,
): AgentExecutableObservation {
  if (providerObservation.kind === 'absent') return executable
  return {
    path: executable.path ?? providerObservation.executablePath,
    present: true,
    version: executable.version ?? providerObservation.version,
  }
}

function versionsConflict(left: string | undefined, right: string | undefined): boolean {
  if (left === undefined || right === undefined) return false
  const order = compareVersions(left, right)
  return order === undefined ? left !== right : order !== 0
}

function executableIdentityConflicts(
  agent: AgentDefinition,
  state: InstalledAgentState | undefined,
  receipt: LifecycleReceipt | undefined,
  binding: LifecycleProviderBinding,
): boolean {
  const identities = [agent.binaryName, state?.binaryName, receipt?.executableName, binding.target.binaryName].filter(
    (identity): identity is string => identity !== undefined,
  )
  return new Set(identities).size > 1
}

function providerTargetMatches(binding: LifecycleProviderBinding, observation: ProviderObservation): boolean {
  return binding.target.id === observation.target.id && binding.target.kind === observation.target.kind
}

function conflictingProviderTargetObservation(
  agent: AgentDefinition,
  executable: AgentExecutableObservation,
  observedAt: string,
): LifecycleObservation {
  if (executable.present) {
    return presentObservation(agent, executable, observedAt, { kind: 'conflicting-source' })
  }
  return {
    drift: { kind: 'conflicting-source' },
    kind: 'indeterminate',
    observedAt,
    reason: 'Provider evidence does not match the requested target identity.',
    targetId: agent.name,
  }
}

function providerOutcomeReason(outcome: Exclude<ProviderOutcome<ProviderObservation>, { kind: 'success' }>): string {
  switch (outcome.kind) {
    case 'unsupported':
      return outcome.reason ?? `Provider does not support ${outcome.operation}.`
    case 'unavailable':
    case 'failed':
    case 'indeterminate':
      return outcome.reason
    case 'cancelled':
      return outcome.reason ?? 'Provider observation was cancelled.'
    case 'timed-out':
      return `Provider observation timed out after ${outcome.timeoutMs}ms.`
  }
}

function isNonSuccessProviderOutcome(
  outcome: ProviderOutcome<ProviderObservation>,
): outcome is Exclude<ProviderOutcome<ProviderObservation>, { kind: 'success' }> {
  return outcome.kind !== 'success'
}

function safeProviderRejectionReason(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Provider observation rejected: ${error.message.trim().slice(0, 500)}`
  }
  return 'Provider observation rejected unexpectedly.'
}
