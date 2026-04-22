import type { CommandResult } from '../output/types'
import { createSuccessResult, emitCommandResult } from '../output'
import { inspectRegisteredAgents } from '../services/agents'
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
  const inspections = await inspectRegisteredAgents()

  return emitCommandResult(createSuccessResult<{ agents: ListedAgent[] }>({
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
  }), renderListHuman)
}

function renderListHuman(result: { data?: { agents: ListedAgent[] } }): void {
  console.log(pc.bold('\nAI Agents:\n'))

  for (const agent of result.data?.agents ?? []) {
    const nameStr = agent.displayName.padEnd(18)
    const statusStr = agent.installed ? pc.green('installed') : pc.gray('not installed')
    const versionStr = agent.installed ? pc.dim(agent.installedVersion ?? 'unknown version') : ''
    const updateStr = agent.installed ? pc.cyan(agent.updateLabel) : ''
    const sourceStr = agent.installed ? pc.dim(agent.sourceLabel) : ''

    console.log(`  ${nameStr} ${statusStr}  ${versionStr}${updateStr ? `  ${updateStr}` : ''}${sourceStr ? `  ${sourceStr}` : ''}`)
  }

  console.log()
}
