import type { CommandResult } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { installAgent, trackInstalledAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'
import { pc } from '../utils/color'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isResourceLockError } from '../utils/lock'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'

interface EnsureCommandData {
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

export async function ensureCommand(agentName: string): Promise<CommandResult<EnsureCommandData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return emitCommandResult(
      createErrorResult<EnsureCommandData>({
        action: 'ensure',
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
      renderEnsureHuman,
    )
  }

  const { agent, inspection } = resolved
  if (inspection.inPath) {
    if (inspection.installedState) {
      return emitCommandResult(
        createSuccessResult<EnsureCommandData>({
          action: 'ensure',
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
        }),
        renderEnsureHuman,
      )
    }

    const adoptableMethod = getAdoptableExistingInstallMethod(inspection.methods)
    if (adoptableMethod) {
      if (isDryRunEnabled()) {
        return emitCommandResult(
          createSuccessResult<EnsureCommandData>({
            action: 'ensure',
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
                code: 'DRY_RUN',
                message: `Dry run: would record the existing ${agent.displayName} install in Quantex state.`,
              },
            ],
          }),
          renderEnsureHuman,
        )
      }

      emitCommandEvent({
        action: 'ensure',
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

      try {
        const installedState = await trackInstalledAgent(agent, adoptableMethod)

        return emitCommandResult(
          createSuccessResult<EnsureCommandData>({
            action: 'ensure',
            data: {
              agent: {
                displayName: agent.displayName,
                name: agent.name,
              },
              changed: true,
              installState: {
                installType: installedState.installType,
                packageName: installedState.packageName,
              },
              installed: true,
            },
            target: {
              kind: 'agent',
              name: agent.name,
            },
            warnings: [
              {
                code: 'TRACKED_EXISTING_INSTALL',
                message: `${agent.displayName} is already installed. Quantex is now tracking the existing install.`,
              },
            ],
          }),
          renderEnsureHuman,
        )
      } catch (error) {
        if (isResourceLockError(error)) {
          return emitCommandResult(
            createErrorResult<EnsureCommandData>({
              action: 'ensure',
              data: {
                agent: {
                  displayName: agent.displayName,
                  name: agent.name,
                },
                changed: false,
                installed: true,
              },
              ...createResourceLockedError(error, {
                kind: 'agent',
                name: agent.name,
              }),
            }),
            renderEnsureHuman,
          )
        }

        throw error
      }
    }

    return emitCommandResult(
      createSuccessResult<EnsureCommandData>({
        action: 'ensure',
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
            code: 'UNTRACKED_EXISTING_INSTALL',
            message: `${agent.displayName} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.`,
          },
        ],
      }),
      renderEnsureHuman,
    )
  }

  if (isDryRunEnabled()) {
    return emitCommandResult(
      createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: {
            displayName: agent.displayName,
            name: agent.name,
          },
          changed: false,
          installed: false,
        },
        target: {
          kind: 'agent',
          name: agent.name,
        },
        warnings: [
          {
            code: 'DRY_RUN',
            message: `Dry run: would install ${agent.displayName}.`,
          },
        ],
      }),
      renderEnsureHuman,
    )
  }

  emitCommandEvent({
    action: 'ensure',
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
  } catch (error) {
    if (isResourceLockError(error)) {
      return emitCommandResult(
        createErrorResult<EnsureCommandData>({
          action: 'ensure',
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
        }),
        renderEnsureHuman,
      )
    }

    throw error
  }

  if (result.success) {
    return emitCommandResult(
      createSuccessResult<EnsureCommandData>({
        action: 'ensure',
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
      }),
      renderEnsureHuman,
    )
  }

  return emitCommandResult(
    createErrorResult<EnsureCommandData>({
      action: 'ensure',
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
    }),
    renderEnsureHuman,
  )
}

function renderEnsureHuman(result: {
  data?: EnsureCommandData
  error: { message: string } | null
  warnings: Array<{ code?: string; message: string }>
}): void {
  if (result.error) {
    printError(pc.red(result.error.message))
    return
  }

  if (!result.data) return

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      if (warning.code === 'TRACKED_EXISTING_INSTALL') {
        printInfo(pc.green(warning.message))
        continue
      }

      if (warning.code === 'DRY_RUN') {
        printWarn(pc.cyan(warning.message))
        continue
      }

      printWarn(pc.yellow(warning.message))
    }
    return
  }

  if (result.data.changed) {
    printInfo(pc.cyan(`Installing ${result.data.agent.displayName}...`))
    printInfo(pc.green(`${result.data.agent.displayName} is now installed.`))
    return
  }

  printInfo(pc.green(`${result.data.agent.displayName} is already installed.`))
}
