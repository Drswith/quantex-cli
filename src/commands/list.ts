import pc from 'picocolors'
import { getAllAgents } from '../agents'
import { isBinaryInPath } from '../utils/detect'
import { getInstalledVersion } from '../utils/version'

export async function listCommand(): Promise<void> {
  const agents = getAllAgents()

  console.log(pc.bold('\nAI Agents:\n'))

  for (const agent of agents) {
    const inPath = await isBinaryInPath(agent.binaryName)
    const version = inPath ? await getInstalledVersion(agent.binaryName) : undefined

    const nameStr = agent.displayName.padEnd(18)
    const statusStr = inPath ? pc.green('installed') : pc.gray('not installed')
    const versionStr = version ? pc.dim(version) : ''

    console.log(`  ${nameStr} ${statusStr}  ${versionStr}`)
  }

  console.log()
}
