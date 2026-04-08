import type { AgentDefinition } from '../agents'
import type { ManagedInstallType } from '../package-manager'
import type { InstalledAgentState } from '../state'
import pc from 'picocolors'
import { getAgentByNameOrAlias, getAllAgents } from '../agents'
import { updateAgent, updateAgentsByType } from '../package-manager'
import { getInstalledAgentState } from '../state'
import { isBinaryInPath } from '../utils/detect'
import { getInstalledVersion, getLatestVersion } from '../utils/version'

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
  const groupedUpdates: Record<ManagedInstallType, PendingUpdate[]> = {
    bun: [],
    npm: [],
  }
  const fallbackUpdates: PendingUpdate[] = []

  for (const agent of getAllAgents()) {
    const inPath = await isBinaryInPath(agent.binaryName)
    if (!inPath)
      continue

    const updateCheck = await getUpdateCheck(agent)
    if (!updateCheck.needsUpdate) {
      console.log(pc.green(`${agent.displayName} is up to date (${updateCheck.installed})`))
      continue
    }

    console.log(pc.cyan(`Updating ${agent.displayName}...${updateCheck.versionHint}`))

    const installedState = await getInstalledAgentState(agent.name)
    if (installedState?.packageName && (installedState.installType === 'bun' || installedState.installType === 'npm')) {
      groupedUpdates[installedState.installType].push({ agent, state: installedState })
      continue
    }

    fallbackUpdates.push({ agent, state: installedState })
  }

  await updateGroupedAgents('bun', groupedUpdates.bun)
  await updateGroupedAgents('npm', groupedUpdates.npm)

  for (const { agent, state } of fallbackUpdates)
    await performUpdate(agent, state, false)
}

async function updateGroupedAgents(type: ManagedInstallType, updates: PendingUpdate[]): Promise<void> {
  if (updates.length === 0)
    return

  const success = await updateAgentsByType(type, updates.map(item => item.state!.packageName!))

  if (success) {
    for (const { agent } of updates)
      console.log(pc.green(`${agent.displayName} updated successfully!`))
    return
  }

  for (const { agent, state } of updates)
    await performUpdate(agent, state, false)
}

async function updateSingleAgent(agent: AgentDefinition): Promise<void> {
  const updateCheck = await getUpdateCheck(agent)

  if (!updateCheck.needsUpdate) {
    console.log(pc.green(`${agent.displayName} is up to date (${updateCheck.installed})`))
    return
  }

  console.log(pc.cyan(`Updating ${agent.displayName}...${updateCheck.versionHint}`))
  await performUpdate(agent, await getInstalledAgentState(agent.name), false)
}

async function getUpdateCheck(agent: AgentDefinition): Promise<{ installed?: string, latest?: string, needsUpdate: boolean, versionHint: string }> {
  const installed = await getInstalledVersion(agent.binaryName)
  const latest = await getLatestVersion(agent.package)

  const versionHint = installed
    ? ` (${installed} -> ${latest ?? 'latest'})`
    : ''

  return {
    installed,
    latest,
    needsUpdate: !(installed && latest && installed === latest),
    versionHint,
  }
}

async function performUpdate(agent: AgentDefinition, installedState?: InstalledAgentState, withStartLog = true): Promise<void> {
  if (withStartLog) {
    const updateCheck = await getUpdateCheck(agent)
    console.log(pc.cyan(`Updating ${agent.displayName}...${updateCheck.versionHint}`))
  }

  const result = await updateAgent(agent, installedState)

  if (result.success) {
    console.log(pc.green(`${agent.displayName} updated successfully!`))
  }
  else {
    console.log(pc.red(`Failed to update ${agent.displayName}.`))
  }
}
