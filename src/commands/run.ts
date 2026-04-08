import pc from 'picocolors'
import prompts from 'prompts'
import { installAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'

export async function runCommand(agentName: string, args: string[]): Promise<number> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return 1
  }

  const { agent, inspection } = resolved

  if (!inspection.inPath) {
    const response = await prompts({
      type: 'confirm',
      name: 'install',
      message: `${agent.displayName} is not installed. Would you like to install it?`,
      initial: true,
    })

    if (!response.install) {
      console.log(pc.yellow('Installation cancelled.'))
      return 1
    }

    console.log(pc.cyan(`Installing ${agent.displayName}...`))
    const result = await installAgent(agent)
    if (!result.success) {
      console.log(pc.red(`Failed to install ${agent.displayName}.`))
      return 1
    }
  }

  try {
    const proc = Bun.spawn([agent.binaryName, ...args], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode ?? 1
  }
  catch (e) {
    console.log(pc.red(`Failed to launch ${agent.displayName}: ${e instanceof Error ? e.message : String(e)}`))
    return 1
  }
}
