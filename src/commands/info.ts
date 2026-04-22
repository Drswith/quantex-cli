import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { resolveAgentInspection } from '../services/agents'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'

interface AgentInfoData {
  agent: {
    aliases: string[]
    binaryName: string
    description: string
    displayName: string
    installMethods: Array<{
      command: string
      label: string
      type: string
    }>
    name: string
    packageName?: string
    selfUpdateCommands: string[]
  }
  inspection: {
    binaryPath?: string
    installed: boolean
    installedVersion?: string
    latestVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    sourceLabel?: string
  }
}

export async function infoCommand(agentName: string): Promise<CommandResult<AgentInfoData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return emitCommandResult(createErrorResult<AgentInfoData>({
      action: 'info',
      error: {
        code: 'AGENT_NOT_FOUND',
        details: {
          input: agentName,
        },
        message: `Unknown agent: ${agentName}`,
      },
      target: {
        kind: 'agent',
        name: agentName,
      },
    }), renderInfoHuman)
  }

  const { agent, inspection } = resolved
  const selfUpdateCommands = agent.selfUpdate
    ? [agent.selfUpdate.command, ...(agent.selfUpdate.fallbackCommands ?? [])].map(command => command.join(' '))
    : []

  return emitCommandResult(createSuccessResult<AgentInfoData>({
    action: 'info',
    data: {
      agent: {
        aliases: agent.lookupAliases ?? [],
        binaryName: agent.binaryName,
        description: agent.description,
        displayName: agent.displayName,
        installMethods: inspection.methods.map(method => ({
          command: formatInstallMethodCommand(agent, method),
          label: formatInstallMethodLabel(method),
          type: method.type,
        })),
        name: agent.name,
        packageName: agent.packages?.npm,
        selfUpdateCommands,
      },
      inspection: {
        binaryPath: inspection.binaryPath,
        installed: inspection.inPath,
        installedVersion: inspection.installedVersion,
        latestVersion: inspection.latestVersion,
        lifecycle: inspection.lifecycle,
        sourceLabel: inspection.inPath ? inspection.sourceLabel : undefined,
      },
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderInfoHuman)
}

function renderInfoHuman(result: { data?: AgentInfoData, error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data)
    return

  console.log(pc.bold(`\n${result.data.agent.displayName}\n`))
  console.log(`  Name:         ${result.data.agent.name}`)
  console.log(`  Aliases:      ${result.data.agent.aliases.join(', ') || '-'}`)
  console.log(`  Description:  ${result.data.agent.description}`)
  console.log(`  Package:      ${result.data.agent.packageName ?? '-'}`)
  console.log(`  Binary:       ${result.data.agent.binaryName}`)
  console.log(`  Update:       ${result.data.agent.selfUpdateCommands.join(' || ') || '-'}`)
  console.log(`  Installed:    ${result.data.inspection.installed ? pc.green('Yes') : pc.red('No')}`)
  if (result.data.inspection.sourceLabel)
    console.log(`  Source:       ${result.data.inspection.sourceLabel}`)
  if (result.data.inspection.installed)
    console.log(`  Lifecycle:    ${result.data.inspection.lifecycle}`)
  if (result.data.inspection.installedVersion)
    console.log(`  Version:      ${result.data.inspection.installedVersion}`)
  if (result.data.inspection.latestVersion)
    console.log(`  Latest:       ${result.data.inspection.latestVersion}`)
  if (result.data.inspection.binaryPath)
    console.log(`  Path:         ${result.data.inspection.binaryPath}`)

  console.log(pc.bold('\n  Install Methods:'))
  for (const method of result.data.agent.installMethods) {
    console.log(`    ${pc.green('+')} [${method.label}] ${method.command}`)
  }

  console.log()
}
