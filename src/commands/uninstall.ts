import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { uninstallAgent } from '../package-manager'
import { resolveAgent } from '../services/agents'

interface UninstallCommandData {
  agent: {
    displayName: string
    name: string
  }
  changed: boolean
}

export async function uninstallCommand(agentName: string): Promise<CommandResult<UninstallCommandData>> {
  const agent = resolveAgent(agentName)
  if (!agent) {
    return emitCommandResult(createErrorResult<UninstallCommandData>({
      action: 'uninstall',
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
    }), renderUninstallHuman)
  }

  const success = await uninstallAgent(agent)

  if (success) {
    return emitCommandResult(createSuccessResult<UninstallCommandData>({
      action: 'uninstall',
      data: {
        agent: {
          displayName: agent.displayName,
          name: agent.name,
        },
        changed: true,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }), renderUninstallHuman)
  }

  return emitCommandResult(createErrorResult<UninstallCommandData>({
    action: 'uninstall',
    data: {
      agent: {
        displayName: agent.displayName,
        name: agent.name,
      },
      changed: false,
    },
    error: {
      code: 'UNINSTALL_FAILED',
      message: `Failed to uninstall ${agent.displayName}.`,
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderUninstallHuman)
}

function renderUninstallHuman(result: { data?: UninstallCommandData, error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data)
    return

  console.log(pc.cyan(`Uninstalling ${result.data.agent.displayName}...`))
  console.log(pc.green(`${result.data.agent.displayName} uninstalled successfully!`))
}
