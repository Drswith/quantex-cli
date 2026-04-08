import pc from 'picocolors'
import { getAllAgents } from '../agents'
import { getInstalledAgentState } from '../state'
import { isBinaryInPath } from '../utils/detect'
import { formatInstalledSource, formatUpdateManagement } from '../utils/install'
import { getInstalledVersion } from '../utils/version'

export async function listCommand(): Promise<void> {
  const agents = getAllAgents()

  console.log(pc.bold('\nAI Agents:\n'))

  for (const agent of agents) {
    const inPath = await isBinaryInPath(agent.binaryName)
    const version = inPath ? await getInstalledVersion(agent.binaryName) : undefined
    const installedState = inPath ? await getInstalledAgentState(agent.name) : undefined

    const nameStr = agent.displayName.padEnd(18)
    const statusStr = inPath ? pc.green('installed') : pc.gray('not installed')
    const versionStr = inPath ? pc.dim(version ?? 'unknown version') : ''
    const updateStr = inPath ? pc.cyan(formatUpdateManagement(installedState)) : ''
    const sourceStr = inPath ? pc.dim(formatInstalledSource(installedState)) : ''

    console.log(`  ${nameStr} ${statusStr}  ${versionStr}${updateStr ? `  ${updateStr}` : ''}${sourceStr ? `  ${sourceStr}` : ''}`)
  }

  console.log()
}
