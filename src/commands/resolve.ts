import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { resolveAgentInspection } from '../services/agents'
import { pc } from '../utils/color'

interface ResolveCommandData {
  agent: {
    binaryName: string
    displayName: string
    name: string
  }
  resolution: {
    binaryPath: string
    installSource: string
    installedVersion?: string
    lifecycle: 'managed' | 'unmanaged'
    sourceLabel: string
    suggestedLaunchCommand: string[]
  }
}

export async function resolveCommand(agentName: string): Promise<CommandResult<ResolveCommandData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return emitCommandResult(createErrorResult<ResolveCommandData>({
      action: 'resolve',
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
    }), renderResolveHuman)
  }

  const { agent, inspection } = resolved
  if (!inspection.inPath || !inspection.binaryPath) {
    return emitCommandResult(createErrorResult<ResolveCommandData>({
      action: 'resolve',
      error: {
        code: 'AGENT_NOT_INSTALLED',
        message: `${agent.displayName} is not installed.`,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }), renderResolveHuman)
  }

  return emitCommandResult(createSuccessResult<ResolveCommandData>({
    action: 'resolve',
    data: {
      agent: {
        binaryName: agent.binaryName,
        displayName: agent.displayName,
        name: agent.name,
      },
      resolution: {
        binaryPath: inspection.binaryPath,
        installSource: inspection.installedState?.installType ?? 'detected-in-path',
        installedVersion: inspection.installedVersion,
        lifecycle: inspection.lifecycle,
        sourceLabel: inspection.sourceLabel,
        suggestedLaunchCommand: [inspection.binaryPath],
      },
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderResolveHuman)
}

function renderResolveHuman(result: { data?: ResolveCommandData, error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data)
    return

  console.log(pc.bold(`\n${result.data.agent.displayName}\n`))
  console.log(`  Name:         ${result.data.agent.name}`)
  console.log(`  Binary:       ${result.data.agent.binaryName}`)
  console.log(`  Path:         ${result.data.resolution.binaryPath}`)
  console.log(`  Source:       ${result.data.resolution.sourceLabel}`)
  console.log(`  Lifecycle:    ${result.data.resolution.lifecycle}`)
  console.log(`  Install Type: ${result.data.resolution.installSource}`)
  if (result.data.resolution.installedVersion)
    console.log(`  Version:      ${result.data.resolution.installedVersion}`)
  console.log(`  Launch:       ${result.data.resolution.suggestedLaunchCommand.join(' ')}`)
  console.log()
}
