import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { installAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isResourceLockError } from '../utils/lock'

interface InstallCommandData {
  agent: {
    displayName: string
    name: string
  }
  changed: boolean
  installState?: {
    installType: string
    packageName?: string
  }
  installed: boolean
}

export async function installCommand(agentName: string): Promise<CommandResult<InstallCommandData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return emitCommandResult(createErrorResult<InstallCommandData>({
      action: 'install',
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
    }), renderInstallHuman)
  }

  const { agent, inspection } = resolved
  if (inspection.inPath) {
    return emitCommandResult(createSuccessResult<InstallCommandData>({
      action: 'install',
      data: {
        agent: {
          displayName: agent.displayName,
          name: agent.name,
        },
        changed: false,
        installed: true,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
      warnings: [
        {
          code: 'ALREADY_INSTALLED',
          message: `${agent.displayName} is already installed.`,
        },
      ],
    }), renderInstallHuman)
  }

  emitCommandEvent({
    action: 'install',
    data: {
      agent: {
        displayName: agent.displayName,
        name: agent.name,
      },
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
    type: 'started',
  })

  let result
  try {
    result = await installAgent(agent)
  }
  catch (error) {
    if (isResourceLockError(error)) {
      return emitCommandResult(createErrorResult<InstallCommandData>({
        action: 'install',
        data: {
          agent: {
            displayName: agent.displayName,
            name: agent.name,
          },
          changed: false,
          installed: false,
        },
        ...createResourceLockedError(error, {
          kind: 'agent',
          name: agent.name,
        }),
      }), renderInstallHuman)
    }

    throw error
  }

  if (result.success) {
    return emitCommandResult(createSuccessResult<InstallCommandData>({
      action: 'install',
      data: {
        agent: {
          displayName: agent.displayName,
          name: agent.name,
        },
        changed: true,
        installState: result.installedState
          ? {
              installType: result.installedState.installType,
              packageName: result.installedState.packageName,
            }
          : undefined,
        installed: true,
      },
      target: {
        kind: 'agent',
        name: agent.name,
      },
    }), renderInstallHuman)
  }

  return emitCommandResult(createErrorResult<InstallCommandData>({
    action: 'install',
    data: {
      agent: {
        displayName: agent.displayName,
        name: agent.name,
      },
      changed: false,
      installed: false,
    },
    error: {
      code: 'INSTALL_FAILED',
      message: `Failed to install ${agent.displayName}.`,
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  }), renderInstallHuman)
}

function renderInstallHuman(result: { data?: InstallCommandData, error: { message: string } | null, warnings: Array<{ message: string }> }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data)
    return

  if (result.warnings.length > 0) {
    for (const warning of result.warnings)
      console.log(pc.yellow(warning.message))
    return
  }

  console.log(pc.cyan(`Installing ${result.data.agent.displayName}...`))
  console.log(pc.green(`${result.data.agent.displayName} installed successfully!`))
}
