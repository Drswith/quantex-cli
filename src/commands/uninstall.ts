import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { uninstallAgent } from '../package-manager'
import { resolveAgent } from '../services/agents'
import { getInstalledAgentState } from '../state'
import { pc } from '../utils/color'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isResourceLockError } from '../utils/lock'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'

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
    return emitCommandResult(
      createErrorResult<UninstallCommandData>({
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
      }),
      renderUninstallHuman,
    )
  }

  if (isDryRunEnabled()) {
    const installedState = await getInstalledAgentState(agent.name)
    if (!installedState) {
      return emitCommandResult(
        createErrorResult<UninstallCommandData>({
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
        }),
        renderUninstallHuman,
      )
    }

    return emitCommandResult(
      createSuccessResult<UninstallCommandData>({
        action: 'uninstall',
        data: {
          agent: {
            displayName: agent.displayName,
            name: agent.name,
          },
          changed: false,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
        warnings: [
          {
            code: 'DRY_RUN',
            message: `Dry run: would uninstall ${agent.displayName}.`,
          },
        ],
      }),
      renderUninstallHuman,
    )
  }

  let success
  try {
    success = await uninstallAgent(agent)
  } catch (error) {
    if (isResourceLockError(error)) {
      return emitCommandResult(
        createErrorResult<UninstallCommandData>({
          action: 'uninstall',
          data: {
            agent: {
              displayName: agent.displayName,
              name: agent.name,
            },
            changed: false,
          },
          ...createResourceLockedError(error, {
            kind: 'agent',
            name: agent.name,
          }),
        }),
        renderUninstallHuman,
      )
    }

    throw error
  }

  if (success) {
    return emitCommandResult(
      createSuccessResult<UninstallCommandData>({
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
      }),
      renderUninstallHuman,
    )
  }

  return emitCommandResult(
    createErrorResult<UninstallCommandData>({
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
    }),
    renderUninstallHuman,
  )
}

function renderUninstallHuman(result: {
  data?: UninstallCommandData
  error: { message: string } | null
  warnings?: Array<{ message: string }>
}): void {
  if (result.error) {
    printError(pc.red(result.error.message))
    return
  }

  if (!result.data) return

  if (result.warnings && result.warnings.length > 0) {
    for (const warning of result.warnings) printWarn(pc.yellow(warning.message))
    return
  }

  printInfo(pc.cyan(`Uninstalling ${result.data.agent.displayName}...`))
  printInfo(pc.green(`${result.data.agent.displayName} uninstalled successfully!`))
}
