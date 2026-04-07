import pc from 'picocolors'
import { getAgentByNameOrAlias } from '../agents'
import { uninstallAgent } from '../package-manager'

export async function uninstallCommand(agentName: string): Promise<void> {
  const agent = getAgentByNameOrAlias(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  console.log(pc.cyan(`Uninstalling ${agent.displayName}...`))
  const success = await uninstallAgent(agent)

  if (success) {
    console.log(pc.green(`${agent.displayName} uninstalled successfully!`))
  }
  else {
    console.log(pc.red(`Failed to uninstall ${agent.displayName}.`))
  }
}
