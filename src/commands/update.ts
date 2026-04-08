import type { AgentDefinition } from '../agents'
import type { ManagedInstallType, ManagedPackageSpec } from '../package-manager'
import type { InstalledAgentState } from '../state'
import pc from 'picocolors'
import { getAgentByNameOrAlias, getAllAgents } from '../agents'
import { inspectAgent, inspectAllAgents } from '../agents/inspection'
import { createUpdatePlan, isInspectionUpdateAvailable } from '../agents/update-plan'
import { updateAgent, updateAgentsByType } from '../package-manager'
import { canUpdateInstalledState } from '../utils/install'

export async function updateCommand(agentName: string | undefined, all: boolean): Promise<void> {
  if (all) {
    await updateAllAgents()
    return
  }

  if (!agentName) {
    console.log(pc.red('Please specify an agent name or use --all flag'))
    return
  }

  const agent = getAgentByNameOrAlias(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  await updateSingleAgent(agent)
}

interface PendingUpdate {
  agent: AgentDefinition
  state?: InstalledAgentState
}

async function updateAllAgents(): Promise<void> {
  const inspections = await inspectAllAgents(getAllAgents())
  const plan = createUpdatePlan(inspections)

  for (const inspection of plan.upToDate)
    console.log(pc.green(`${inspection.agent.displayName} is up to date (${inspection.installedVersion ?? 'unknown'})`))

  for (const entry of plan.entries) {
    const inspection = entry.inspection
    console.log(pc.cyan(`Updating ${inspection.agent.displayName}...${getVersionHint(inspection.installedVersion, inspection.latestVersion)}`))
  }

  await updateGroupedAgents('bun', plan.grouped.bun.map(entry => toPendingUpdate(entry.inspection)))
  await updateGroupedAgents('npm', plan.grouped.npm.map(entry => toPendingUpdate(entry.inspection)))
  await updateGroupedAgents('brew', plan.grouped.brew.map(entry => toPendingUpdate(entry.inspection)))
  await updateGroupedAgents('winget', plan.grouped.winget.map(entry => toPendingUpdate(entry.inspection)))

  for (const entry of plan.manual)
    await performUpdate(entry.inspection.agent, entry.inspection.installedState, false)
}

async function updateGroupedAgents(type: ManagedInstallType, updates: PendingUpdate[]): Promise<void> {
  if (updates.length === 0)
    return

  const packages: ManagedPackageSpec[] = updates.map(item => ({
    packageName: item.state!.packageName!,
    packageTargetKind: item.state!.packageTargetKind,
  }))

  const success = await updateAgentsByType(type, packages)

  if (success) {
    for (const { agent } of updates)
      console.log(pc.green(`${agent.displayName} updated successfully!`))
    return
  }

  for (const { agent, state } of updates)
    await performUpdate(agent, state, false)
}

async function updateSingleAgent(agent: AgentDefinition): Promise<void> {
  const inspection = await inspectAgent(agent)

  if (!inspection.inPath) {
    console.log(pc.red(`${agent.displayName} is not installed.`))
    return
  }

  if (!isInspectionUpdateAvailable(inspection)) {
    console.log(pc.green(`${agent.displayName} is up to date (${inspection.installedVersion ?? 'unknown'})`))
    return
  }

  console.log(pc.cyan(`Updating ${agent.displayName}...${getVersionHint(inspection.installedVersion, inspection.latestVersion)}`))
  await performUpdate(agent, inspection.installedState, false)
}

async function performUpdate(agent: AgentDefinition, installedState?: InstalledAgentState, withStartLog = true): Promise<void> {
  if (withStartLog) {
    const inspection = await inspectAgent(agent)
    console.log(pc.cyan(`Updating ${agent.displayName}...${getVersionHint(inspection.installedVersion, inspection.latestVersion)}`))
  }

  if (installedState && !canUpdateInstalledState(installedState)) {
    console.log(pc.yellow(`${agent.displayName} uses an unmanaged install source and cannot be updated automatically.`))
    return
  }

  const result = await updateAgent(agent, installedState)

  if (result.success) {
    console.log(pc.green(`${agent.displayName} updated successfully!`))
  }
  else {
    console.log(pc.red(`Failed to update ${agent.displayName}.`))
  }
}

function getVersionHint(installed?: string, latest?: string): string {
  return installed ? ` (${installed} -> ${latest ?? 'latest'})` : ''
}

function toPendingUpdate(inspection: {
  agent: AgentDefinition
  installedState?: InstalledAgentState
}): PendingUpdate {
  return {
    agent: inspection.agent,
    state: inspection.installedState,
  }
}
