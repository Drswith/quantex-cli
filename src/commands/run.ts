import pc from 'picocolors'
import prompts from 'prompts'
import { getAgentByNameOrAlias } from '../agents'
import { installAgent } from '../package-manager'
import { isBinaryInPath } from '../utils/detect'

export async function runCommand(agentName: string, args: string[]): Promise<number> {
  const agent = getAgentByNameOrAlias(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return 1
  }

  const inPath = await isBinaryInPath(agent.binaryName)

  if (!inPath) {
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
    const success = await installAgent(agent)
    if (!success) {
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
