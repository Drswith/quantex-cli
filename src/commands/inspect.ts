import type { CommandResult } from '../output/types'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable } from '../output/human'
import { resolveCliReadObservation } from '../services/core-read-observations'
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
  const resolved = await resolveCliReadObservation(agentName)
  if (!resolved) {
    return emitCommandResult(
      createErrorResult<InspectCommandData>({
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
      }),
      renderInspectHuman,
    )
  }

  const { agent } = resolved
  const inspection = projectObservationToV1Inspection(resolved)
  const selfUpdateCommands = agent.selfUpdate
    ? [agent.selfUpdate.command, ...(agent.selfUpdate.fallbackCommands ?? [])].map(command => command.join(' '))
    : []

  return emitCommandResult(
    createSuccessResult<InspectCommandData>({
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
    }),
    renderInspectHuman,
  )
}

function renderInspectHuman(result: { data?: InspectCommandData; error: { message: string } | null }): void {
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
    { label: 'Installed', value: result.data.inspection.installed ? pc.green('yes') : pc.red('no') },
    { label: 'Update mode', value: result.data.inspection.updateLabel },
    { label: 'Self update', value: result.data.agent.selfUpdateCommands.join(' · ') || '—' },
    ...(result.data.inspection.sourceLabel ? [{ label: 'Source', value: result.data.inspection.sourceLabel }] : []),
    ...(result.data.inspection.installedVersion
      ? [{ label: 'Version', value: result.data.inspection.installedVersion }]
      : []),
    ...(result.data.inspection.latestVersion ? [{ label: 'Latest', value: result.data.inspection.latestVersion }] : []),
    ...(result.data.inspection.binaryPath ? [{ label: 'Path', value: result.data.inspection.binaryPath }] : []),
  ]
  for (const line of renderHumanFields(fields, { labelStyle: pc.bold, width })) console.log(line)

  const capabilities = [
    { capability: 'Auto install', value: result.data.capabilities.canAutoInstall },
    { capability: 'Self update', value: result.data.capabilities.canSelfUpdate },
    { capability: 'Auto uninstall', value: result.data.capabilities.canAutoUninstall },
    { capability: 'Runnable', value: result.data.capabilities.canRun },
  ]
  console.log(pc.bold('\nCapabilities\n'))
  for (const line of renderHumanTable(
    capabilities,
    [
      { header: 'Capability', minWidth: 8, value: capability => capability.capability },
      {
        header: 'Available',
        value: capability => (capability.value ? pc.green('yes') : pc.dim('no')),
      },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }

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
