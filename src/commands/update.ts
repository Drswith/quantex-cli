import type { AgentDefinition, InstallMethod, ManagedInstallType } from '../agents'
import type { CommandResult } from '../output/types'
import type { ManagedPackageSpec } from '../package-manager'
import type { InstalledAgentState } from '../state'
import pc from 'picocolors'
import { getAgentUpdateFailureHint, getAgentUpdateStrategy, getManualAgentUpdateMessage } from '../agent-update'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { updateAgent, updateAgentsByType } from '../package-manager'
import { resolveAgent } from '../services/agents'
import { planAgentUpdates, planSingleAgentUpdate } from '../services/update'
import { canAutoUpdateAgent, canUpdateInstallType } from '../utils/install'

type UpdateStatus = 'failed' | 'manual-required' | 'up-to-date' | 'updated'

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
  status: UpdateStatus
  strategy?: string
}

export async function updateCommand(agentName: string | undefined, all: boolean): Promise<CommandResult<UpdateCommandData>> {
  if (all)
    return updateAllAgents()

  if (!agentName) {
    return emitCommandResult(createErrorResult<UpdateCommandData>({
      action: 'update',
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'Please specify an agent name or use --all flag',
      },
      target: {
        kind: 'agent',
      },
    }), renderUpdateHuman)
  }

  const agent = resolveAgent(agentName)
  if (!agent) {
    return emitCommandResult(createErrorResult<UpdateCommandData>({
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
    }), renderUpdateHuman)
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
  const execution = await executePlannedUpdates(plan)

  if (execution.hasFailures) {
    return emitCommandResult(createErrorResult<UpdateCommandData>({
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
    }), renderUpdateHuman)
  }

  return emitCommandResult(createSuccessResult<UpdateCommandData>({
    action: 'update',
    data: {
      results: execution.results,
      scope: 'all',
    },
    target: {
      kind: 'agent',
    },
  }), renderUpdateHuman)
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
    return emitCommandResult(createErrorResult<UpdateCommandData>({
      action: 'update',
      error: {
        code: 'AGENT_NOT_INSTALLED',
        message: `${agent.displayName} is not installed.`,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }), renderUpdateHuman)
  }

  const execution = await executePlannedUpdates(plan)

  if (execution.hasFailures) {
    return emitCommandResult(createErrorResult<UpdateCommandData>({
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
    }), renderUpdateHuman)
  }

  return emitCommandResult(createSuccessResult<UpdateCommandData>({
    action: 'update',
    data: {
      results: execution.results,
      scope: 'single',
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderUpdateHuman)
}

async function executePlannedUpdates(plan: Awaited<ReturnType<typeof planAgentUpdates>>): Promise<{ hasFailures: boolean, results: UpdateResultItem[] }> {
  const results: UpdateResultItem[] = []

  for (const inspection of plan.upToDate) {
    pushUpdateResult(results, {
      displayName: inspection.agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      name: inspection.agent.name,
      status: 'up-to-date',
    })
  }

  for (const inspection of plan.skippedManualCheck) {
    pushUpdateResult(results, {
      displayName: inspection.agent.displayName,
      message: getManualAgentUpdateMessage(inspection.agent),
      name: inspection.agent.name,
      status: 'manual-required',
    })
  }

  for (const bucket of plan.grouped) {
    const groupResults = await updateGroupedAgents(bucket.type, bucket.packages, bucket.updates)
    for (const result of groupResults)
      pushUpdateResult(results, result)
  }

  for (const entry of plan.manual) {
    pushUpdateResult(results, await performUpdate(entry.agent, entry.state, entry.inspection.methods, entry.inspection))
  }

  return {
    hasFailures: results.some(result => result.status === 'failed'),
    results,
  }
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

async function updateGroupedAgents(
  type: ManagedInstallType,
  packages: ManagedPackageSpec[],
  updates: Array<{ agent: AgentDefinition, inspection: { installedVersion?: string, latestVersion?: string, methods?: InstallMethod[] }, state?: InstalledAgentState, strategy: 'managed' | 'manual-hint' | 'self-update' }>,
): Promise<UpdateResultItem[]> {
  if (updates.length === 0)
    return []

  const success = await updateAgentsByType(type, packages)

  if (success) {
    return updates.map(({ agent, inspection, strategy }) => ({
      displayName: agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      name: agent.name,
      status: 'updated',
      strategy: strategy === 'managed' ? `managed/${type}` : strategy,
    }))
  }

  return Promise.all(updates.map(({ agent, inspection, state }) => performUpdate(agent, state, inspection.methods, inspection)))
}

async function performUpdate(
  agent: AgentDefinition,
  installedState?: InstalledAgentState,
  methods?: InstallMethod[],
  inspection?: { installedVersion?: string, latestVersion?: string, methods?: InstallMethod[] },
): Promise<UpdateResultItem> {
  const resolvedMethods = methods ?? inspection?.methods ?? []
  const strategy = getAgentUpdateStrategy({
    agent,
    installedState,
    methods: resolvedMethods,
  })
  const installedVersion = inspection?.installedVersion
  const latestVersion = inspection?.latestVersion

  if (strategy === 'manual-hint' && !canAutoUpdateAgent(agent, installedState) && !resolvedMethods.some(method => canUpdateInstallType(method.type))) {
    return {
      displayName: agent.displayName,
      installedVersion,
      latestVersion,
      message: getManualAgentUpdateMessage(agent),
      name: agent.name,
      status: 'manual-required',
      strategy,
    }
  }

  const result = await updateAgent(agent, installedState)

  if (result.success) {
    return {
      displayName: agent.displayName,
      installedVersion,
      latestVersion,
      name: agent.name,
      status: 'updated',
      strategy,
    }
  }

  return {
    displayName: agent.displayName,
    hint: getAgentUpdateFailureHint(agent, strategy),
    installedVersion,
    latestVersion,
    name: agent.name,
    status: 'failed',
    strategy,
  }
}

function renderUpdateHuman(result: { data?: UpdateCommandData, error: { code: string, message: string } | null }): void {
  if (!result.data) {
    if (result.error)
      console.log(pc.red(result.error.message))
    return
  }

  for (const item of result.data.results) {
    switch (item.status) {
      case 'up-to-date':
        console.log(pc.green(`${item.displayName} is up to date (${item.installedVersion ?? 'unknown'})`))
        break
      case 'manual-required':
        if (item.message)
          console.log(pc.yellow(item.message))
        break
      case 'updated':
        console.log(pc.cyan(`Updating ${item.displayName}${item.strategy ? ` via ${item.strategy}` : ''}...${getVersionHint(item.installedVersion, item.latestVersion)}`))
        console.log(pc.green(`${item.displayName} updated successfully!`))
        break
      case 'failed':
        console.log(pc.cyan(`Updating ${item.displayName}${item.strategy ? ` via ${item.strategy}` : ''}...${getVersionHint(item.installedVersion, item.latestVersion)}`))
        console.log(pc.red(`Failed to update ${item.displayName}.`))
        if (item.hint)
          console.log(pc.yellow(item.hint))
        break
    }
  }

  if (!result.data.results.length && result.error)
    console.log(pc.red(result.error.message))
}

function getVersionHint(installed?: string, latest?: string): string {
  return installed ? ` (${installed} -> ${latest ?? 'latest'})` : ''
}
