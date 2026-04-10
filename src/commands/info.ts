import pc from 'picocolors'
import { resolveAgentInspection } from '../services/agents'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'

export async function infoCommand(agentName: string): Promise<void> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return
  }

  const { agent, inspection } = resolved

  console.log(pc.bold(`\n${agent.displayName}\n`))
  console.log(`  Name:         ${agent.name}`)
  console.log(`  Aliases:      ${agent.lookupAliases?.join(', ') ?? '-'}`)
  console.log(`  Description:  ${agent.description}`)
  console.log(`  Package:      ${agent.packages?.npm ?? '-'}`)
  console.log(`  Binary:       ${agent.binaryName}`)
  console.log(`  Installed:    ${inspection.inPath ? pc.green('Yes') : pc.red('No')}`)
  if (inspection.inPath)
    console.log(`  Source:       ${inspection.sourceLabel}`)
  if (inspection.installedState)
    console.log(`  Lifecycle:    ${inspection.lifecycle}`)
  if (inspection.installedVersion)
    console.log(`  Version:      ${inspection.installedVersion}`)
  if (inspection.latestVersion)
    console.log(`  Latest:       ${inspection.latestVersion}`)
  if (inspection.binaryPath)
    console.log(`  Path:         ${inspection.binaryPath}`)

  console.log(pc.bold('\n  Install Methods:'))
  for (const method of inspection.methods) {
    console.log(`    ${pc.green('+')} [${formatInstallMethodLabel(method)}] ${formatInstallMethodCommand(agent, method)}`)
  }

  console.log()
}
