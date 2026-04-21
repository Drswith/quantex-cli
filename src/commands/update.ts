import type { AgentDefinition, ManagedInstallType } from '../agents'
import type { ManagedPackageSpec } from '../package-manager'
import type { InstalledAgentState } from '../state'
import pc from 'picocolors'
import { updateAgent, updateAgentsByType } from '../package-manager'
import { resolveAgent } from '../services/agents'
import { getSingleAgentUpdateStatus, planAgentUpdates } from '../services/update'
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

  const agent = resolveAgent(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  await updateSingleAgent(agent)
}

async function updateAllAgents(): Promise<void> {
  const plan = await planAgentUpdates()

  for (const inspection of plan.upToDate)
    console.log(pc.green(`${inspection.agent.displayName} is up to date (${inspection.installedVersion ?? 'unknown'})`))

  for (const inspection of plan.skippedManualCheck)
    console.log(pc.yellow(`${inspection.agent.displayName} uses a manually managed install source. Please check for updates manually.`))

  for (const entry of plan.entries) {
    const inspection = entry.inspection
    console.log(pc.cyan(`Updating ${inspection.agent.displayName}...${getVersionHint(inspection.installedVersion, inspection.latestVersion)}`))
  }

  for (const bucket of plan.grouped)
    await updateGroupedAgents(bucket.type, bucket.packages, bucket.updates)

  for (const entry of plan.manual)
    await performUpdate(entry.agent, entry.state, false)
}

async function updateGroupedAgents(
  type: ManagedInstallType,
  packages: ManagedPackageSpec[],
  updates: Array<{ agent: AgentDefinition, state?: InstalledAgentState }>,
): Promise<void> {
  if (updates.length === 0)
    return

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
  const { inspection, updateAvailable } = await getSingleAgentUpdateStatus(agent)

  if (!inspection.inPath) {
    console.log(pc.red(`${agent.displayName} is not installed.`))
    return
  }

  if (!updateAvailable) {
    console.log(pc.green(`${agent.displayName} is up to date (${inspection.installedVersion ?? 'unknown'})`))
    return
  }

  console.log(pc.cyan(`Updating ${agent.displayName}...${getVersionHint(inspection.installedVersion, inspection.latestVersion)}`))
  await performUpdate(agent, inspection.installedState, false)
}

async function performUpdate(agent: AgentDefinition, installedState?: InstalledAgentState, withStartLog = true): Promise<void> {
  if (withStartLog) {
    const { inspection } = await getSingleAgentUpdateStatus(agent)
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
