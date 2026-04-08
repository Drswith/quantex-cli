import pc from 'picocolors'
import { getAgentByNameOrAlias } from '../agents'
import { inspectAgent } from '../agents/inspection'
import { installAgent } from '../package-manager'

export async function installCommand(agentName: string): Promise<void> {
  const agent = getAgentByNameOrAlias(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  const inspection = await inspectAgent(agent)
  if (inspection.inPath) {
    console.log(pc.yellow(`${agent.displayName} is already installed.`))
    return
  }

  console.log(pc.cyan(`Installing ${agent.displayName}...`))
  const result = await installAgent(agent)

  if (result.success) {
    console.log(pc.green(`${agent.displayName} installed successfully!`))
  }
  else {
    console.log(pc.red(`Failed to install ${agent.displayName}.`))
  }
}
