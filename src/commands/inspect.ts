import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { resolveAgentInspection } from '../services/agents'
import { pc } from '../utils/color'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'

interface InspectCommandData {
  agent: {
    aliases: string[]
    binaryName: string
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
  capabilities: {
    canAutoInstall: boolean
    canAutoUninstall: boolean
    canRun: boolean
    canSelfUpdate: boolean
  }
  inspection: {
    binaryPath?: string
    installed: boolean
    installedVersion?: string
    latestVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    sourceLabel?: string
    updateLabel: string
  }
}

export async function inspectCommand(agentName: string): Promise<CommandResult<InspectCommandData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return emitCommandResult(createErrorResult<InspectCommandData>({
      action: 'inspect',
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
    }), renderInspectHuman)
  }

  const { agent, inspection } = resolved
  const selfUpdateCommands = agent.selfUpdate
    ? [agent.selfUpdate.command, ...(agent.selfUpdate.fallbackCommands ?? [])].map(command => command.join(' '))
    : []

  return emitCommandResult(createSuccessResult<InspectCommandData>({
    action: 'inspect',
    data: {
      agent: {
        aliases: agent.lookupAliases ?? [],
        binaryName: agent.binaryName,
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
      capabilities: {
        canAutoInstall: inspection.methods.length > 0,
        canAutoUninstall: inspection.inPath && inspection.lifecycle === 'managed',
        canRun: inspection.inPath,
        canSelfUpdate: selfUpdateCommands.length > 0,
      },
      inspection: {
        binaryPath: inspection.binaryPath,
        installed: inspection.inPath,
        installedVersion: inspection.installedVersion,
        latestVersion: inspection.latestVersion,
        lifecycle: inspection.lifecycle,
        sourceLabel: inspection.inPath ? inspection.sourceLabel : undefined,
        updateLabel: inspection.updateLabel,
      },
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderInspectHuman)
}

function renderInspectHuman(result: { data?: InspectCommandData, error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data)
    return

  console.log(pc.bold(`\n${result.data.agent.displayName}\n`))
  console.log(`  Name:         ${result.data.agent.name}`)
  console.log(`  Aliases:      ${result.data.agent.aliases.join(', ') || '-'}`)
  console.log(`  Package:      ${result.data.agent.packageName ?? '-'}`)
  console.log(`  Binary:       ${result.data.agent.binaryName}`)
  console.log(`  Installed:    ${result.data.inspection.installed ? pc.green('Yes') : pc.red('No')}`)
  console.log(`  Update Mode:  ${result.data.inspection.updateLabel}`)
  console.log(`  Self Update:  ${result.data.agent.selfUpdateCommands.join(' || ') || '-'}`)
  if (result.data.inspection.sourceLabel)
    console.log(`  Source:       ${result.data.inspection.sourceLabel}`)
  if (result.data.inspection.installedVersion)
    console.log(`  Version:      ${result.data.inspection.installedVersion}`)
  if (result.data.inspection.latestVersion)
    console.log(`  Latest:       ${result.data.inspection.latestVersion}`)
  if (result.data.inspection.binaryPath)
    console.log(`  Path:         ${result.data.inspection.binaryPath}`)

  console.log(pc.bold('\n  Capabilities:'))
  console.log(`    auto-install:   ${result.data.capabilities.canAutoInstall ? 'yes' : 'no'}`)
  console.log(`    self-update:    ${result.data.capabilities.canSelfUpdate ? 'yes' : 'no'}`)
  console.log(`    auto-uninstall: ${result.data.capabilities.canAutoUninstall ? 'yes' : 'no'}`)
  console.log(`    runnable:       ${result.data.capabilities.canRun ? 'yes' : 'no'}`)

  console.log(pc.bold('\n  Install Methods:'))
  for (const method of result.data.agent.installMethods)
    console.log(`    ${pc.green('+')} [${method.label}] ${method.command}`)

  console.log()
}
