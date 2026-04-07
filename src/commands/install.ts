import pc from 'picocolors'
import { getAgentByNameOrAlias } from '../agents'
import { installAgent } from '../package-manager'
import { isBinaryInPath } from '../utils/detect'

export async function installCommand(agentName: string): Promise<void> {
  const agent = getAgentByNameOrAlias(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  const inPath = await isBinaryInPath(agent.binaryName)
  if (inPath) {
    console.log(pc.yellow(`${agent.displayName} is already installed.`))
    return
  }

  console.log(pc.cyan(`Installing ${agent.displayName}...`))
  const success = await installAgent(agent)

  if (success) {
    console.log(pc.green(`${agent.displayName} installed successfully!`))
  }
  else {
    console.log(pc.red(`Failed to install ${agent.displayName}.`))
  }
}
