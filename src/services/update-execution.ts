import type { AgentUpdateStrategy } from '../agent-update'
import type { PendingAgentUpdate, PlannedAgentUpdates } from './update'
import * as agentUpdate from '../agent-update'
import * as packageManager from '../package-manager'
import * as installUtils from '../utils/install'
import * as lockUtils from '../utils/lock'
import * as versionUtils from '../utils/version'

export type UpdateStatus = 'failed' | 'locked' | 'manual-required' | 'planned' | 'up-to-date' | 'updated'

export interface UpdateResultItem {
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

export interface UpdateExecution {
  hasFailures: boolean
  results: UpdateResultItem[]
}

export interface UpdateExecutionOptions {
  dryRun: boolean
  isCancelled: () => boolean
  onProgress?: (result: UpdateResultItem) => void
}

export interface UpdateExecutionDependencies {
  canAutoUpdateAgent: typeof installUtils.canAutoUpdateAgent
  getAgentUpdateFailureHint: typeof agentUpdate.getAgentUpdateFailureHint
  getAgentUpdateStrategy: typeof agentUpdate.getAgentUpdateStrategy
  getInstalledVersion: typeof versionUtils.getInstalledVersion
  getManualAgentUpdateMessage: typeof agentUpdate.getManualAgentUpdateMessage
  getUntrackedPathAgentUpdateMessage: typeof agentUpdate.getUntrackedPathAgentUpdateMessage
  isResourceLockError: typeof lockUtils.isResourceLockError
  updateAgent: typeof packageManager.updateAgent
  updateAgentsByType: typeof packageManager.updateAgentsByType
}

function createDefaultDependencies(): UpdateExecutionDependencies {
  return {
    canAutoUpdateAgent: installUtils.canAutoUpdateAgent,
    getAgentUpdateFailureHint: agentUpdate.getAgentUpdateFailureHint,
    getAgentUpdateStrategy: agentUpdate.getAgentUpdateStrategy,
    getInstalledVersion: versionUtils.getInstalledVersion,
    getManualAgentUpdateMessage: agentUpdate.getManualAgentUpdateMessage,
    getUntrackedPathAgentUpdateMessage: agentUpdate.getUntrackedPathAgentUpdateMessage,
    isResourceLockError: lockUtils.isResourceLockError,
    updateAgent: packageManager.updateAgent,
    updateAgentsByType: packageManager.updateAgentsByType,
  }
}

export async function executePlannedUpdates(
  plan: PlannedAgentUpdates,
  options: UpdateExecutionOptions,
  dependencies: UpdateExecutionDependencies = createDefaultDependencies(),
): Promise<UpdateExecution> {
  const results: UpdateResultItem[] = []
  const pushResult = (result: UpdateResultItem): void => {
    results.push(result)
    options.onProgress?.(result)
  }

  for (const inspection of plan.upToDate) {
    pushResult({
      displayName: inspection.agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      name: inspection.agent.name,
      status: 'up-to-date',
    })
  }

  for (const inspection of plan.skippedManualCheck) {
    pushResult({
      displayName: inspection.agent.displayName,
      message: dependencies.getManualAgentUpdateMessage(inspection.agent),
      name: inspection.agent.name,
      status: 'manual-required',
    })
  }

  for (const inspection of plan.untrackedInPath) {
    pushResult({
      displayName: inspection.agent.displayName,
      message: dependencies.getUntrackedPathAgentUpdateMessage(inspection.agent),
      name: inspection.agent.name,
      status: 'manual-required',
    })
  }

  for (const bucket of plan.grouped) {
    if (options.isCancelled()) break

    const groupResults = await updateGroupedAgents(bucket, options, dependencies)
    for (const result of groupResults) pushResult(result)

    if (options.isCancelled()) break
  }

  for (const entry of plan.manual) {
    if (options.isCancelled()) break

    pushResult(await performUpdate(entry, options, dependencies))
  }

  return {
    hasFailures: results.some(result => result.status === 'failed' || result.status === 'locked'),
    results,
  }
}

async function updateGroupedAgents(
  bucket: PlannedAgentUpdates['grouped'][number],
  options: UpdateExecutionOptions,
  dependencies: UpdateExecutionDependencies,
): Promise<UpdateResultItem[]> {
  if (bucket.updates.length === 0) return []

  if (options.dryRun) {
    return bucket.updates.map(({ agent, inspection, strategy }) => ({
      displayName: agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      message: `Dry run: would update ${agent.displayName}.`,
      name: agent.name,
      status: 'planned',
      strategy: formatGroupedStrategy(strategy, bucket.type),
    }))
  }

  try {
    const success = await dependencies.updateAgentsByType(bucket.type, bucket.packages)

    if (success) {
      return bucket.updates.map(({ agent, inspection, strategy }) => ({
        displayName: agent.displayName,
        installedVersion: inspection.installedVersion,
        latestVersion: inspection.latestVersion,
        name: agent.name,
        status: 'updated',
        strategy: formatGroupedStrategy(strategy, bucket.type),
      }))
    }

    const fallbackResults: UpdateResultItem[] = []
    for (const update of bucket.updates) {
      if (options.isCancelled()) break

      fallbackResults.push(await performUpdate(update, options, dependencies))
    }
    return fallbackResults
  } catch (error) {
    if (!dependencies.isResourceLockError(error)) throw error

    return bucket.updates.map(({ agent, inspection, strategy }) => ({
      displayName: agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      message: error.message,
      name: agent.name,
      resource: error.resource,
      status: 'locked',
      strategy: formatGroupedStrategy(strategy, bucket.type),
    }))
  }
}

async function performUpdate(
  update: PendingAgentUpdate,
  options: UpdateExecutionOptions,
  dependencies: UpdateExecutionDependencies,
): Promise<UpdateResultItem> {
  const { agent, inspection, state: installedState } = update

  if (options.isCancelled()) {
    return {
      displayName: agent.displayName,
      installedVersion: inspection.installedVersion,
      latestVersion: inspection.latestVersion,
      message: 'Update was cancelled before it could start.',
      name: agent.name,
      status: 'failed',
    }
  }

  const strategy = dependencies.getAgentUpdateStrategy({
    agent,
    installedState,
    methods: inspection.methods,
  })
  const installedVersion = inspection.installedVersion
  const latestVersion = inspection.latestVersion

  if (strategy === 'manual-hint' && !dependencies.canAutoUpdateAgent(agent, installedState)) {
    return {
      displayName: agent.displayName,
      installedVersion,
      latestVersion,
      message: dependencies.getManualAgentUpdateMessage(agent),
      name: agent.name,
      status: 'manual-required',
      strategy,
    }
  }

  if (options.dryRun) {
    return {
      displayName: agent.displayName,
      installedVersion,
      latestVersion,
      message: `Dry run: would update ${agent.displayName}.`,
      name: agent.name,
      status: 'planned',
      strategy,
    }
  }

  let result
  try {
    result = await dependencies.updateAgent(agent, installedState)
  } catch (error) {
    if (dependencies.isResourceLockError(error)) {
      return {
        displayName: agent.displayName,
        installedVersion,
        latestVersion,
        message: error.message,
        name: agent.name,
        resource: error.resource,
        status: 'locked',
        strategy,
      }
    }

    throw error
  }

  if (result.success) {
    if (strategy === 'self-update') {
      const verifiedVersion = await dependencies.getInstalledVersion(agent.binaryName, agent.versionProbe)

      if (installedVersion && verifiedVersion) {
        if (verifiedVersion === installedVersion) {
          return {
            displayName: agent.displayName,
            installedVersion: verifiedVersion,
            latestVersion: verifiedVersion,
            name: agent.name,
            status: 'up-to-date',
            strategy,
          }
        }

        return {
          displayName: agent.displayName,
          installedVersion,
          latestVersion: verifiedVersion,
          name: agent.name,
          status: 'updated',
          strategy,
        }
      }
    }

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
    hint: dependencies.getAgentUpdateFailureHint(agent, strategy),
    installedVersion,
    latestVersion,
    name: agent.name,
    status: 'failed',
    strategy,
  }
}

function formatGroupedStrategy(strategy: AgentUpdateStrategy, type: string): string {
  return strategy === 'managed' ? `managed/${type}` : strategy
}
