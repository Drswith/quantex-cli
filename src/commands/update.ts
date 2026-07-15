import type { AgentDefinition } from '../agents'
import type { CommandIdempotencyPolicyFactory } from '../command-runtime'
import type { CommandResult } from '../output/types'
import type {
  LifecycleUpdateBatchCancellationRemainder,
  LifecycleUpdateBatchTargetOutcome,
} from '../services/lifecycle-updates'
import {
  getAgentUpdateFailureHint,
  getAgentUpdateStrategy,
  getManualAgentUpdateMessage,
  getUntrackedPathAgentUpdateMessage,
} from '../agent-update'
import { getCliContext } from '../cli-context'
import {
  createAgentBatchUpdateIdempotencyPolicy,
  createAgentUpdateIdempotencyPolicy,
} from '../idempotency/lifecycle-policy'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { resolveAgent } from '../services/agents'
import {
  createLifecycleUpdateBatchInvocation,
  createSingleAgentLifecycleUpdateInvocation,
  runLifecycleUpdateBatch,
  runSingleAgentLifecycleUpdate,
  type RunSingleAgentLifecycleUpdateOutcome,
} from '../services/lifecycle-updates-production'
import { pc } from '../utils/color'
import { isResourceLockError } from '../utils/lock'
import { printError, printInfo, printWarn } from '../utils/user-output'

type UpdateStatus = 'failed' | 'locked' | 'manual-required' | 'planned' | 'up-to-date' | 'updated'

interface UpdateCommandData {
  results: UpdateResultItem[]
  scope: 'all' | 'single'
}

interface UpdateResultItem {
  displayName: string
  hint?: string
  installedVersion?: string
  latestVersion?: string
  message?: string
  name: string
  resource?: string
  status: UpdateStatus
  strategy?: string
}

interface UpdateCommandDependencies {
  readonly runBatch: typeof runLifecycleUpdateBatch
  readonly runSingle: typeof runSingleAgentLifecycleUpdate
}

export interface UpdateCommandInvocation {
  dispose(): void
  readonly idempotencyPolicy?: CommandIdempotencyPolicyFactory<UpdateCommandData>
  run(): Promise<CommandResult<UpdateCommandData>>
}

export async function updateCommand(
  agentName: string | undefined,
  all: boolean,
  dependencies: UpdateCommandDependencies = {
    runBatch: runLifecycleUpdateBatch,
    runSingle: runSingleAgentLifecycleUpdate,
  },
): Promise<CommandResult<UpdateCommandData>> {
  if (all) return updateAllAgents(dependencies)

  if (!agentName) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Please specify an agent name or use --all flag',
        },
        target: {
          kind: 'agent',
        },
      }),
      renderUpdateHuman,
    )
  }

  const agent = resolveAgent(agentName)
  if (!agent) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        error: {
          code: 'AGENT_NOT_FOUND',
          details: {
            input: agentName,
          },
          message: `Unknown agent: ${agentName}`,
        },
        target: {
          kind: 'agent',
          name: agentName,
        },
      }),
      renderUpdateHuman,
    )
  }

  return updateSingleAgent(agent, dependencies)
}

export function createUpdateCommandInvocation(agentName: string | undefined, all: boolean): UpdateCommandInvocation {
  if (all) {
    const lifecycleInvocation = createLifecycleUpdateBatchInvocation()
    return {
      dispose: lifecycleInvocation.dispose,
      idempotencyPolicy: () => createAgentBatchUpdateIdempotencyPolicy(lifecycleInvocation),
      run: () =>
        updateCommand(agentName, true, {
          runBatch: () => lifecycleInvocation.run(),
          runSingle: runSingleAgentLifecycleUpdate,
        }),
    }
  }
  if (!agentName) {
    return {
      dispose() {},
      run: () => updateCommand(agentName, all),
    }
  }

  const lifecycleInvocation = createSingleAgentLifecycleUpdateInvocation(agentName)
  return {
    dispose: lifecycleInvocation.dispose,
    idempotencyPolicy: () => createAgentUpdateIdempotencyPolicy(agentName, lifecycleInvocation),
    run: () =>
      updateCommand(agentName, false, {
        runBatch: runLifecycleUpdateBatch,
        runSingle: () => lifecycleInvocation.run(),
      }),
  }
}

async function updateAllAgents(dependencies: UpdateCommandDependencies): Promise<CommandResult<UpdateCommandData>> {
  emitCommandEvent({
    action: 'update',
    data: {
      scope: 'all',
    },
    target: {
      kind: 'agent',
    },
    type: 'started',
  })

  const outcome = await dependencies.runBatch()
  const results = projectLifecycleUpdateBatch(outcome)

  if (hasBatchCancellation(outcome)) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results,
          scope: 'all',
        },
        error: {
          code: 'CANCELLED',
          message: 'Update was cancelled before all agents could be updated.',
        },
        target: {
          kind: 'agent',
        },
      }),
      renderUpdateHuman,
    )
  }

  if (results.some(result => result.status === 'failed' || result.status === 'locked')) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results,
          scope: 'all',
        },
        error: {
          code: 'UPDATE_FAILED',
          message: 'One or more agents failed to update.',
        },
        target: {
          kind: 'agent',
        },
      }),
      renderUpdateHuman,
    )
  }

  return emitCommandResult(
    createSuccessResult<UpdateCommandData>({
      action: 'update',
      data: {
        results,
        scope: 'all',
      },
      target: {
        kind: 'agent',
      },
    }),
    renderUpdateHuman,
  )
}

async function updateSingleAgent(
  agent: AgentDefinition,
  dependencies: UpdateCommandDependencies,
): Promise<CommandResult<UpdateCommandData>> {
  emitCommandEvent({
    action: 'update',
    data: {
      agent: agent.name,
      scope: 'single',
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
    type: 'started',
  })

  let outcome: RunSingleAgentLifecycleUpdateOutcome
  try {
    outcome = await dependencies.runSingle(agent.name)
  } catch (error) {
    if (!isResourceLockError(error)) throw error
    const lockedResult: UpdateResultItem = {
      displayName: agent.displayName,
      message: error.message,
      name: agent.name,
      resource: error.resource,
      status: 'locked',
    }
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results: [lockedResult],
          scope: 'single',
        },
        error: {
          code: 'RESOURCE_LOCKED',
          details: { resource: error.resource },
          message: error.message,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
      }),
      renderUpdateHuman,
    )
  }

  const before = getSingleUpdateBefore(outcome)
  if (outcome.kind === 'unknown-agent') {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        error: { code: 'AGENT_NOT_FOUND', message: `Unknown agent: ${agent.name}` },
        target: { kind: 'agent', name: agent.name },
      }),
      renderUpdateHuman,
    )
  }
  if (before?.observation.kind === 'absent') {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        error: { code: 'AGENT_NOT_INSTALLED', message: `${agent.displayName} is not installed.` },
        target: { kind: 'agent', name: agent.name },
      }),
      renderUpdateHuman,
    )
  }

  const result = toSingleUpdateResult(agent, outcome)
  pushUpdateResult([], result)
  if (outcome.kind === 'cancelled') {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: { results: [result], scope: 'single' },
        error: { code: 'CANCELLED', message: `Update of ${agent.displayName} was cancelled.` },
        target: { kind: 'agent', name: agent.name },
      }),
      renderUpdateHuman,
    )
  }
  if (result.status === 'failed' || result.status === 'locked') {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results: [result],
          scope: 'single',
        },
        error: {
          code: 'UPDATE_FAILED',
          message: `Failed to update ${agent.displayName}.`,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
      }),
      renderUpdateHuman,
    )
  }

  return emitCommandResult(
    createSuccessResult<UpdateCommandData>({
      action: 'update',
      data: {
        results: [result],
        scope: 'single',
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }),
    renderUpdateHuman,
  )
}

function toSingleUpdateResult(agent: AgentDefinition, outcome: RunSingleAgentLifecycleUpdateOutcome): UpdateResultItem {
  const before = getSingleUpdateBefore(outcome)
  const plan = 'plan' in outcome ? outcome.plan : undefined
  const installedVersion = before?.observation.kind === 'present' ? before.observation.version : undefined
  const latestVersion = plan?.plannedTargetVersion
  const strategy = plan ? `managed/${plan.binding.providerId}` : before?.binding?.providerId

  switch (outcome.kind) {
    case 'updated':
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion: outcome.receipt.version ?? latestVersion,
        name: agent.name,
        status: 'updated',
        strategy,
      }
    case 'dry-run':
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        message: `Dry run: would update ${agent.displayName}.`,
        name: agent.name,
        status: 'planned',
        strategy,
      }
    case 'not-executed':
      if (outcome.plan.planning.decision === 'up-to-date') {
        return {
          displayName: agent.displayName,
          installedVersion,
          latestVersion,
          name: agent.name,
          status: 'up-to-date',
        }
      }
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        message: getManualAgentUpdateMessage(agent),
        name: agent.name,
        status: 'manual-required',
      }
    case 'blocked':
      return {
        displayName: agent.displayName,
        installedVersion,
        message: outcome.reason,
        name: agent.name,
        status: 'failed',
      }
    case 'cancelled':
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        message: outcome.reason ?? 'Update was cancelled before it could complete.',
        name: agent.name,
        status: 'failed',
        strategy,
      }
    case 'timed-out':
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        message: `Update timed out after ${outcome.timeoutMs}ms.`,
        name: agent.name,
        status: 'failed',
        strategy,
      }
    case 'provider-failed':
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        name: agent.name,
        status: 'failed',
        strategy,
      }
    case 'verification-failed':
    case 'receipt-failed':
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        message: outcome.kind === 'receipt-failed' ? outcome.reason : outcome.verification.reason,
        name: agent.name,
        status: 'failed',
        strategy,
      }
    case 'unknown-agent':
      return { displayName: agent.displayName, name: agent.name, status: 'failed' }
  }
}

function getSingleUpdateBefore(outcome: RunSingleAgentLifecycleUpdateOutcome) {
  if ('plan' in outcome) return outcome.plan.before
  if ('before' in outcome) return outcome.before
  return undefined
}

type LifecycleUpdateBatchCommandOutcome = Awaited<ReturnType<typeof runLifecycleUpdateBatch>>

function projectLifecycleUpdateBatch(outcome: LifecycleUpdateBatchCommandOutcome): UpdateResultItem[] {
  const completedById = new Map(outcome.results.map(result => [result.id, result]))
  const remainderById = new Map(outcome.cancellationRemainder.map(target => [target.id, target]))
  const results: UpdateResultItem[] = []

  for (const target of outcome.plan.targets) {
    const completed = completedById.get(target.id)
    const remainder = remainderById.get(target.id)
    if (completed) pushUpdateResult(results, toBatchUpdateResult(completed))
    else if (remainder) pushUpdateResult(results, toCancellationRemainderResult(remainder))
  }

  return results
}

function toBatchUpdateResult(target: LifecycleUpdateBatchTargetOutcome): UpdateResultItem {
  const before =
    target.planning.kind === 'unknown-agent'
      ? undefined
      : target.planning.kind === 'planned'
        ? target.planning.planned.before
        : target.planning.before
  const agent = resolveAgent(target.agentName)
  if (!agent) {
    return {
      displayName: before?.agent.displayName ?? target.agentName,
      name: target.agentName,
      status: 'failed',
    }
  }

  const execution = target.execution
  if (target.planning.kind === 'blocked' && target.planning.category === 'untracked') {
    return {
      displayName: agent.displayName,
      installedVersion:
        target.planning.before.observation.kind === 'present' ? target.planning.before.observation.version : undefined,
      message: getUntrackedPathAgentUpdateMessage(agent),
      name: agent.name,
      status: 'manual-required',
    }
  }
  if (target.planning.kind === 'blocked' && target.planning.category === 'manual-required') {
    return {
      displayName: agent.displayName,
      installedVersion:
        target.planning.before.observation.kind === 'present' ? target.planning.before.observation.version : undefined,
      message: getManualAgentUpdateMessage(agent),
      name: agent.name,
      status: 'manual-required',
    }
  }
  if (execution?.kind === 'locked') {
    return {
      displayName: agent.displayName,
      installedVersion:
        execution.plan.before.observation.kind === 'present' ? execution.plan.before.observation.version : undefined,
      latestVersion: execution.plan.plannedTargetVersion,
      message: execution.reason,
      name: agent.name,
      resource: execution.resource,
      status: 'locked',
      strategy: `managed/${execution.plan.binding.providerId}`,
    }
  }
  if (execution?.kind === 'unexpected-failure') {
    return {
      displayName: agent.displayName,
      installedVersion:
        execution.plan.before.observation.kind === 'present' ? execution.plan.before.observation.version : undefined,
      latestVersion: execution.plan.plannedTargetVersion,
      message: execution.reason,
      name: agent.name,
      status: 'failed',
      strategy: `managed/${execution.plan.binding.providerId}`,
    }
  }

  const singleOutcome: RunSingleAgentLifecycleUpdateOutcome =
    execution ??
    (target.planning.kind === 'planned' ? { kind: 'not-executed', plan: target.planning.planned } : target.planning)
  const projected = toSingleUpdateResult(agent, singleOutcome)
  if (projected.status === 'failed' && singleOutcome.kind === 'provider-failed') {
    projected.hint = getAgentUpdateFailureHint(
      agent,
      getAgentUpdateStrategy({
        agent,
        installedState: before?.installedState,
        methods: [...(before?.methods ?? [])],
      }),
    )
  }
  return projected
}

function toCancellationRemainderResult(target: LifecycleUpdateBatchCancellationRemainder): UpdateResultItem {
  const agent = resolveAgent(target.agentName)
  const before = target.planning.planned.before
  return {
    displayName: agent?.displayName ?? before.agent.displayName,
    installedVersion: before.observation.kind === 'present' ? before.observation.version : undefined,
    latestVersion: target.planning.planned.plannedTargetVersion,
    message: target.reason ?? 'Update was cancelled before it could start.',
    name: agent?.name ?? target.agentName,
    status: 'failed',
    strategy: `managed/${target.planning.planned.binding.providerId}`,
  }
}

function hasBatchCancellation(outcome: LifecycleUpdateBatchCommandOutcome): boolean {
  return (
    getCliContext().cancelled ||
    outcome.cancellationRemainder.length > 0 ||
    outcome.results.some(result => result.planning.kind === 'cancelled' || result.execution?.kind === 'cancelled')
  )
}

function pushUpdateResult(results: UpdateResultItem[], result: UpdateResultItem): void {
  results.push(result)
  emitCommandEvent({
    action: 'update',
    data: result,
    target: {
      kind: 'agent',
      name: result.name,
    },
    type: 'progress',
  })
}

function renderUpdateHuman(result: {
  data?: UpdateCommandData
  error: { code: string; message: string } | null
}): void {
  if (!result.data) {
    if (result.error) printError(pc.red(result.error.message))
    return
  }

  for (const item of result.data.results) {
    switch (item.status) {
      case 'up-to-date':
        printInfo(pc.green(`${item.displayName} is up to date (${item.installedVersion ?? 'unknown'})`))
        break
      case 'manual-required':
        printWarn(pc.yellow(`${item.displayName}: manual action required.`))
        if (item.message) printWarn(pc.cyan(`Next step: ${item.message}`))
        break
      case 'planned':
        printWarn(
          pc.cyan(
            `Would update ${item.displayName}${item.strategy ? ` via ${item.strategy}` : ''}${getVersionHint(item.installedVersion, item.latestVersion)}`,
          ),
        )
        break
      case 'updated':
        printInfo(
          pc.cyan(
            `Updating ${item.displayName}${item.strategy ? ` via ${item.strategy}` : ''}...${getVersionHint(item.installedVersion, item.latestVersion)}`,
          ),
        )
        printInfo(pc.green(`${item.displayName} updated successfully!`))
        break
      case 'failed':
        printInfo(
          pc.cyan(
            `Updating ${item.displayName}${item.strategy ? ` via ${item.strategy}` : ''}...${getVersionHint(item.installedVersion, item.latestVersion)}`,
          ),
        )
        printError(pc.red(`Failed to update ${item.displayName}.`))
        if (item.hint) printWarn(pc.cyan(`Next step: ${item.hint}`))
        break
      case 'locked':
        printWarn(pc.yellow(item.message ?? `Another quantex process is already updating ${item.displayName}.`))
        break
    }
  }

  if (result.data.results.length > 1) printUpdateSummary(result.data.results)

  if (!result.data.results.length && result.error) printError(pc.red(result.error.message))
}

function getVersionHint(installed?: string, latest?: string): string {
  return installed ? ` (${installed} -> ${latest ?? 'latest'})` : ''
}

function printUpdateSummary(results: UpdateResultItem[]): void {
  const counts = {
    failed: 0,
    locked: 0,
    manualRequired: 0,
    planned: 0,
    upToDate: 0,
    updated: 0,
  }

  for (const item of results) {
    switch (item.status) {
      case 'up-to-date':
        counts.upToDate += 1
        break
      case 'manual-required':
        counts.manualRequired += 1
        break
      case 'planned':
        counts.planned += 1
        break
      case 'updated':
        counts.updated += 1
        break
      case 'failed':
        counts.failed += 1
        break
      case 'locked':
        counts.locked += 1
        break
    }
  }

  const parts = [
    counts.updated ? `updated ${counts.updated}` : undefined,
    counts.upToDate ? `up to date ${counts.upToDate}` : undefined,
    counts.manualRequired ? `manual ${counts.manualRequired}` : undefined,
    counts.failed ? `failed ${counts.failed}` : undefined,
    counts.locked ? `locked ${counts.locked}` : undefined,
    counts.planned ? `planned ${counts.planned}` : undefined,
  ].filter(Boolean)

  if (parts.length > 0) printInfo(pc.bold(`Summary: ${parts.join(', ')}`))
}
