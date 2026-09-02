import type { CommandResult, CommandWarning } from '../output/types'
import { createSupersededPackageWarning } from '../agent-update'
import { resolveSupersededPackage } from '../agents/superseded'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanFields, renderHumanTable } from '../output/human'
import { resolveCliReadObservation } from '../services/core-read-observations'
import { pc } from '../utils/color'
import { printWarn } from '../utils/user-output'
import { projectCliReadObservation } from './cli-read-projection'

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
  // Core read ports already back inspect; project the richer v1 CLI payload rather than
  // wrapping the narrower public SDK inspect() descriptors into a second CLI-shaped API.
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

  const projected = projectCliReadObservation(resolved)
  const { agent, inspection, summary } = projected

  return emitCommandResult(
    createSuccessResult<InspectCommandData>({
      action: 'inspect',
      data: {
        agent: summary.agent,
        capabilities: {
          canAutoInstall: inspection.methods.length > 0,
          canAutoUninstall: inspection.inPath && inspection.lifecycle === 'managed',
          canRun: inspection.inPath,
          canSelfUpdate: summary.agent.selfUpdateCommands.length > 0,
        },
        inspection: summary.inspection,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
      warnings: supersededPackageWarnings(agent, inspection.installedState),
    }),
    renderInspectHuman,
  )
}

function supersededPackageWarnings(
  agent: Parameters<typeof resolveSupersededPackage>[0] & { displayName: string },
  installedState: Parameters<typeof resolveSupersededPackage>[1],
): CommandWarning[] {
  const migration = resolveSupersededPackage(agent, installedState)
  return migration ? [createSupersededPackageWarning(agent, migration)] : []
}

function renderInspectHuman(result: {
  data?: InspectCommandData
  error: { message: string } | null
  warnings: CommandWarning[]
}): void {
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
  for (const warning of result.warnings) printWarn(pc.yellow(warning.message))
}
