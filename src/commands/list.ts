import type { CommandResult, CommandWarning } from '../output/types'
import { createSupersededPackageWarning } from '../agent-update'
import { resolveSupersededPackage } from '../agents/superseded'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanTable, renderHumanWrapped } from '../output/human'
import { observeCliReadRegisteredAgents } from '../services/core-read-observations'
import { pc } from '../utils/color'
import { printWarn } from '../utils/user-output'
import { isVersionNewer } from '../utils/version'

interface ListedAgent {
  binaryName: string
  displayName: string
  installed: boolean
  installedVersion?: string
  latestVersion?: string
  lifecycle: 'managed' | 'unmanaged'
  name: string
  sourceLabel: string
  updateLabel: string
}

export async function listCommand(): Promise<CommandResult<{ agents: ListedAgent[] }>> {
  // Core read ports already back list; project the richer v1 inspection rows rather than
  // wrapping the narrower public SDK list() descriptors into a second CLI-shaped API.
  const inspections = (await observeCliReadRegisteredAgents()).map(projectObservationToV1Inspection)

  return emitCommandResult(
    createSuccessResult<{ agents: ListedAgent[] }>({
      action: 'list',
      data: {
        agents: inspections.map(inspection => ({
          binaryName: inspection.agent.binaryName,
          displayName: inspection.agent.displayName,
          installed: inspection.inPath,
          installedVersion: inspection.installedVersion,
          latestVersion: inspection.latestVersion,
          lifecycle: inspection.lifecycle,
          name: inspection.agent.name,
          sourceLabel: inspection.sourceLabel,
          updateLabel: inspection.updateLabel,
        })),
      },
      target: {
        kind: 'system',
        name: 'agents',
      },
      warnings: inspections.flatMap(inspection => {
        const migration = resolveSupersededPackage(inspection.agent, inspection.installedState)
        return migration ? [createSupersededPackageWarning(inspection.agent, migration)] : []
      }),
    }),
    renderListHuman,
  )
}

function renderListHuman(result: { data?: { agents: ListedAgent[] }; warnings: CommandWarning[] }): void {
  const agents = result.data?.agents ?? []
  const width = getHumanTerminalWidth()
  // Superseded rows are identified from the warnings rather than a payload field, so the
  // v1 agent objects in structured output keep their shape.
  const superseded = new Set(
    result.warnings
      .filter(warning => warning.code === 'AGENT_PACKAGE_SUPERSEDED')
      .map(warning => warning.details?.agentName)
      .filter((name): name is string => typeof name === 'string'),
  )
  console.log(pc.bold('\nAI Agents:\n'))
  for (const line of renderHumanTable(
    agents,
    [
      {
        header: 'Agent',
        minWidth: 8,
        value: agent => agent.displayName,
      },
      {
        header: 'Installed',
        minWidth: 5,
        value: agent => (agent.installed ? pc.green('yes') : pc.dim('no')),
      },
      {
        header: 'Version',
        maxWidth: 22,
        optional: true,
        priority: 2,
        value: agent => (agent.installed ? pc.dim(agent.installedVersion ?? 'unknown') : pc.dim('—')),
      },
      {
        header: 'Source',
        optional: true,
        priority: 2,
        value: agent => pc.dim(agent.installed ? formatListSource(agent.sourceLabel) : '—'),
      },
      {
        header: 'Managed',
        optional: true,
        priority: 1,
        value: agent => (agent.installed ? pc.cyan(formatListUpdateMode(agent.updateLabel)) : pc.dim('—')),
      },
      {
        header: 'Available',
        optional: true,
        priority: 0,
        value: agent => formatListAvailableVersion(agent, superseded),
      },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }

  const installed = agents.filter(agent => agent.installed).length
  const summary = `${installed} installed · ${agents.length - installed} not installed`
  console.log()
  for (const line of renderHumanWrapped(pc.dim(summary), { indent: '  ', width })) console.log(line)
  for (const line of renderHumanWrapped(pc.dim('Details: qtx inspect <agent>'), { indent: '  ', width }))
    console.log(line)
  console.log()
  for (const warning of result.warnings) printWarn(pc.yellow(warning.message))
}

function formatListUpdateMode(label: string): string {
  return label.replace(/ update$/u, '')
}

function formatListAvailableVersion(agent: ListedAgent, superseded: ReadonlySet<string>): string {
  if (superseded.has(agent.name)) return pc.yellow('migrate')

  if (!agent.installed || !agent.installedVersion || !agent.latestVersion) return pc.dim('—')

  return isVersionNewer(agent.latestVersion, agent.installedVersion) ? pc.cyan(agent.latestVersion) : pc.dim('—')
}

function formatListSource(label: string): string {
  const managedInstallType = /^managed via ([^ (]+)/u.exec(label)?.[1]
  if (managedInstallType) return managedInstallType

  if (label === 'script installer') return 'script'
  if (label === 'binary installer') return 'binary'
  if (label === 'detected on disk') return 'detected'

  return '—'
}
