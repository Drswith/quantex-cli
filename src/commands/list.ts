import type { CommandResult } from '../output/types'
import { projectObservationToV1Inspection } from '../compatibility/agent-inspection'
import { createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanTable, renderHumanWrapped } from '../output/human'
import { observeCliReadRegisteredAgents } from '../services/core-read-observations'
import { pc } from '../utils/color'

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
    }),
    renderListHuman,
  )
}

function renderListHuman(result: { data?: { agents: ListedAgent[] } }): void {
  const agents = result.data?.agents ?? []
  const width = getHumanTerminalWidth()
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
        header: 'Update',
        optional: true,
        priority: 1,
        value: agent => (agent.installed ? pc.cyan(formatListUpdateMode(agent.updateLabel)) : pc.dim('—')),
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
}

function formatListUpdateMode(label: string): string {
  return label.replace(/ update$/u, '')
}

function formatListSource(label: string): string {
  const managedInstallType = /^managed via ([^ (]+)/u.exec(label)?.[1]
  if (managedInstallType) return managedInstallType

  if (label === 'script installer') return 'script'
  if (label === 'binary installer') return 'binary'
  if (label === 'detected in PATH') return 'PATH'

  return '—'
}
