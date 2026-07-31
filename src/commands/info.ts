import type { CommandResult } from '../output/types'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable } from '../output/human'
import { resolveCliReadObservation } from '../services/core-read-observations'
import { pc } from '../utils/color'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'

interface AgentInfoData {
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
  const resolved = await resolveCliReadObservation(agentName)
  if (!resolved) {
    return emitCommandResult(
      createErrorResult<AgentInfoData>({
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
      }),
      renderInfoHuman,
    )
  }

  const { agent } = resolved
  const inspection = projectObservationToV1Inspection(resolved)
  const selfUpdateCommands = agent.selfUpdate
    ? [agent.selfUpdate.command, ...(agent.selfUpdate.fallbackCommands ?? [])].map(command => command.join(' '))
    : []

  return emitCommandResult(
    createSuccessResult<AgentInfoData>({
      action: 'info',
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
    }),
    renderInfoHuman,
  )
}

function renderInfoHuman(result: { data?: AgentInfoData; error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data) return

  const width = getHumanTerminalWidth()
  console.log(pc.bold(`\n${result.data.agent.displayName}\n`))
  const fields = [
    { label: 'Name', value: result.data.agent.name },
    { label: 'Aliases', value: result.data.agent.aliases.join(', ') || '—' },
    { label: 'Package', value: result.data.agent.packageName ?? '—' },
    { label: 'Binary', value: result.data.agent.binaryName },
    { label: 'Self update', value: result.data.agent.selfUpdateCommands.join(' · ') || '—' },
    { label: 'Installed', value: result.data.inspection.installed ? pc.green('yes') : pc.red('no') },
    ...(result.data.inspection.sourceLabel ? [{ label: 'Source', value: result.data.inspection.sourceLabel }] : []),
    ...(result.data.inspection.installed ? [{ label: 'Lifecycle', value: result.data.inspection.lifecycle }] : []),
    ...(result.data.inspection.installedVersion
      ? [{ label: 'Version', value: result.data.inspection.installedVersion }]
      : []),
    ...(result.data.inspection.latestVersion ? [{ label: 'Latest', value: result.data.inspection.latestVersion }] : []),
    ...(result.data.inspection.binaryPath ? [{ label: 'Path', value: result.data.inspection.binaryPath }] : []),
  ]
  for (const line of renderHumanFields(fields, { labelStyle: pc.bold, width })) console.log(line)

  console.log(pc.bold('\nInstall Methods\n'))
  if (result.data.agent.installMethods.length === 0) {
    console.log(pc.dim('  No managed install methods'))
  } else {
    for (const line of renderHumanTable(
      result.data.agent.installMethods,
      [
        { header: 'Method', maxWidth: 24, minWidth: 8, value: method => pc.green(method.label) },
        { header: 'Command', minWidth: 16, value: method => method.command, wrap: true },
      ],
      { headerStyle: pc.bold, width },
    )) {
      console.log(line)
    }
  }

  console.log()
}
