import type { AgentDefinition } from '../agents'
import pc from 'picocolors'
import { getAgentByNameOrAlias, getAllAgents } from '../agents'
import { updateAgent } from '../package-manager'
import { isBinaryInPath } from '../utils/detect'
import { getInstalledVersion, getLatestVersion } from '../utils/version'

export async function updateCommand(agentName: string | undefined, all: boolean): Promise<void> {
  if (all) {
    const agents = getAllAgents()
    for (const agent of agents) {
      const inPath = await isBinaryInPath(agent.binaryName)
      if (!inPath)
        continue
      await updateSingleAgent(agent)
    }
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

async function updateSingleAgent(agent: AgentDefinition): Promise<void> {
  const installed = await getInstalledVersion(agent.binaryName)
  const latest = await getLatestVersion(agent.package)

  if (installed && latest && installed === latest) {
    console.log(pc.green(`${agent.displayName} is up to date (${installed})`))
    return
  }

  const versionHint = installed
    ? ` (${installed} -> ${latest ?? 'latest'})`
    : ''
  console.log(pc.cyan(`Updating ${agent.displayName}...${versionHint}`))
  const success = await updateAgent(agent)

  if (success) {
    console.log(pc.green(`${agent.displayName} updated successfully!`))
  }
  else {
    console.log(pc.red(`Failed to update ${agent.displayName}.`))
  }
}
