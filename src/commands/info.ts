import pc from 'picocolors'
import { getAgentByNameOrAlias } from '../agents'
import { getPlatform, isBinaryInPath } from '../utils/detect'
import { getBinaryPath, getInstalledVersion, getLatestVersion } from '../utils/version'

export async function infoCommand(agentName: string): Promise<void> {
  const agent = getAgentByNameOrAlias(agentName)
  if (!agent) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  const inPath = await isBinaryInPath(agent.binaryName)
  const installedVersion = inPath ? await getInstalledVersion(agent.binaryName) : undefined
  const latestVersion = await getLatestVersion(agent.package)
  const binaryPath = inPath ? await getBinaryPath(agent.binaryName) : undefined
  const platform = getPlatform()

  console.log(pc.bold(`\n${agent.displayName}\n`))
  console.log(`  Name:         ${agent.name}`)
  console.log(`  Aliases:      ${agent.aliases.join(', ')}`)
  console.log(`  Description:  ${agent.description}`)
  console.log(`  Package:      ${agent.package}`)
  console.log(`  Binary:       ${agent.binaryName}`)
  console.log(`  Installed:    ${inPath ? pc.green('Yes') : pc.red('No')}`)
  if (installedVersion)
    console.log(`  Version:      ${installedVersion}`)
  if (latestVersion)
    console.log(`  Latest:       ${latestVersion}`)
  if (binaryPath)
    console.log(`  Path:         ${binaryPath}`)

  console.log(pc.bold('\n  Install Methods:'))
  for (const method of agent.installMethods) {
    const supported = method.supportedPlatforms.includes(platform)
    const cmd = typeof method.command === 'function' ? method.command(platform) : method.command
    const marker = supported ? pc.green('+') : pc.dim('-')
    console.log(`    ${marker} [${method.type}] ${cmd}`)
  }

  console.log()
}
