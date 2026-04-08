import pc from 'picocolors'
import { installAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'

export async function installCommand(agentName: string): Promise<void> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  const { agent, inspection } = resolved
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
