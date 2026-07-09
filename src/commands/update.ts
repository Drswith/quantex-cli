import type { AgentDefinition } from '../agents'
import type { CommandResult } from '../output/types'
import { getCliContext } from '../cli-context'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { resolveAgent } from '../services/agents'
import { planAgentUpdates, planSingleAgentUpdate } from '../services/update'
import { executePlannedUpdates, type UpdateResultItem } from '../services/update-execution'
import { pc } from '../utils/color'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'

interface UpdateCommandData {
  results: UpdateResultItem[]
  scope: 'all' | 'single'
}

export async function updateCommand(
  agentName: string | undefined,
  all: boolean,
): Promise<CommandResult<UpdateCommandData>> {
  if (all) return updateAllAgents()

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

  return updateSingleAgent(agent)
}

async function updateAllAgents(): Promise<CommandResult<UpdateCommandData>> {
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

  const plan = await planAgentUpdates()
  const execution = await executePlannedUpdates(plan, createUpdateExecutionOptions())

  if (getCliContext().cancelled) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results: execution.results,
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

  if (execution.hasFailures) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results: execution.results,
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
        results: execution.results,
        scope: 'all',
      },
      target: {
        kind: 'agent',
      },
    }),
    renderUpdateHuman,
  )
}

async function updateSingleAgent(agent: AgentDefinition): Promise<CommandResult<UpdateCommandData>> {
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

  const { inspection, plan } = await planSingleAgentUpdate(agent)

  if (!inspection.inPath) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        error: {
          code: 'AGENT_NOT_INSTALLED',
          message: `${agent.displayName} is not installed.`,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
      }),
      renderUpdateHuman,
    )
  }

  const execution = await executePlannedUpdates(plan, createUpdateExecutionOptions())
  const lockedResult = getSingleLockedResult(execution.results)

  if (lockedResult) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results: execution.results,
          scope: 'single',
        },
        error: {
          code: 'RESOURCE_LOCKED',
          details: lockedResult.resource
            ? {
                resource: lockedResult.resource,
              }
            : undefined,
          message: lockedResult.message ?? `Another quantex process is already updating ${agent.displayName}.`,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
      }),
      renderUpdateHuman,
    )
  }

  if (execution.hasFailures) {
    return emitCommandResult(
      createErrorResult<UpdateCommandData>({
        action: 'update',
        data: {
          results: execution.results,
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
        results: execution.results,
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

function createUpdateExecutionOptions() {
  return {
    dryRun: isDryRunEnabled(),
    isCancelled: () => Boolean(getCliContext().cancelled),
    onProgress: (result: UpdateResultItem) => {
      emitCommandEvent({
        action: 'update',
        data: result,
        target: {
          kind: 'agent',
          name: result.name,
        },
        type: 'progress',
      })
    },
  }
}

function getSingleLockedResult(results: UpdateResultItem[]): UpdateResultItem | undefined {
  if (results.length !== 1) return undefined

  return results[0]?.status === 'locked' ? results[0] : undefined
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
