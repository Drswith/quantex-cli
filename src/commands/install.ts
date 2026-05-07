import type { CommandError, CommandResult, CommandWarning } from '../output/types'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { installAgent, trackInstalledAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'
import { pc } from '../utils/color'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isResourceLockError } from '../utils/lock'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'

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

type InstallBatchStatus =
  | 'already-installed'
  | 'failed'
  | 'installed'
  | 'locked'
  | 'planned'
  | 'tracked-existing-install'
  | 'untracked-existing-install'

interface InstallBatchResultItem extends InstallCommandData {
  error?: {
    code: string
    message: string
  }
  input: string
  ok: boolean
  status: InstallBatchStatus
  warnings: Array<{
    code: string
    message: string
  }>
}

interface InstallBatchCommandData {
  results: InstallBatchResultItem[]
  scope: 'batch'
  summary: {
    alreadyInstalled: number
    failed: number
    installed: number
    locked: number
    planned: number
    trackedExistingInstall: number
    untrackedExistingInstall: number
  }
}

interface SingleInstallOptions {
  emitStartedEvent?: boolean
}

export async function installCommand(agentName: string): Promise<CommandResult<InstallCommandData>>
export async function installCommand(
  agentNames: string[],
): Promise<CommandResult<InstallBatchCommandData | InstallCommandData>>
export async function installCommand(
  agentNames: string | string[],
): Promise<CommandResult<InstallBatchCommandData | InstallCommandData>> {
  const requestedAgents = Array.isArray(agentNames) ? agentNames : [agentNames]

  if (requestedAgents.length <= 1) {
    const singleResult = await performSingleInstall(requestedAgents[0]!, { emitStartedEvent: true })
    return emitCommandResult(singleResult, renderInstallHuman)
  }

  emitCommandEvent({
    action: 'install',
    data: {
      scope: 'batch',
    },
    target: {
      kind: 'agent',
    },
    type: 'started',
  })

  const results: InstallBatchResultItem[] = []

  for (const agentName of requestedAgents) {
    const singleResult = await performSingleInstall(agentName)
    const batchResult = toBatchResultItem(agentName, singleResult)
    results.push(batchResult)

    emitCommandEvent({
      action: 'install',
      data: batchResult,
      target: {
        kind: 'agent',
        name: batchResult.agent.name,
      },
      type: 'progress',
    })
  }

  const data: InstallBatchCommandData = {
    results,
    scope: 'batch',
    summary: summarizeBatchResults(results),
  }

  const hasFailures = results.some(result => !result.ok)
  const batchResult = hasFailures
    ? createErrorResult<InstallBatchCommandData>({
        action: 'install',
        data,
        error: createBatchInstallError(results),
        target: {
          kind: 'agent',
        },
      })
    : createSuccessResult<InstallBatchCommandData>({
        action: 'install',
        data,
        target: {
          kind: 'agent',
        },
      })

  return emitCommandResult(batchResult, renderBatchInstallHuman)
}

async function performSingleInstall(
  agentName: string,
  options: SingleInstallOptions = {},
): Promise<CommandResult<InstallCommandData>> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    return createErrorResult<InstallCommandData>({
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
    })
  }

  const { agent, inspection } = resolved
  if (inspection.inPath) {
    if (inspection.installedState) {
      return createSuccessResult<InstallCommandData>({
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
      })
    }

    const adoptableMethod = getAdoptableExistingInstallMethod(
      inspection.methods,
      inspection.resolvedBinaryPath ?? inspection.binaryPath,
    )
    if (adoptableMethod) {
      if (isDryRunEnabled()) {
        return createSuccessResult<InstallCommandData>({
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
              code: 'DRY_RUN',
              message: `Dry run: would record the existing ${agent.displayName} install in Quantex state.`,
            },
          ],
        })
      }

      emitInstallStarted(agent, options.emitStartedEvent)

      try {
        const installedState = await trackInstalledAgent(agent, adoptableMethod)

        return createSuccessResult<InstallCommandData>({
          action: 'install',
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
        })
      } catch (error) {
        if (isResourceLockError(error)) {
          return createErrorResult<InstallCommandData>({
            action: 'install',
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
          })
        }

        throw error
      }
    }

    return createSuccessResult<InstallCommandData>({
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
          code: 'UNTRACKED_EXISTING_INSTALL',
          message: `${agent.displayName} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.`,
        },
      ],
    })
  }

  if (isDryRunEnabled()) {
    return createSuccessResult<InstallCommandData>({
      action: 'install',
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
    })
  }

  emitInstallStarted(agent, options.emitStartedEvent)

  let result
  try {
    result = await installAgent(agent)
  } catch (error) {
    if (isResourceLockError(error)) {
      return createErrorResult<InstallCommandData>({
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
      })
    }

    throw error
  }

  if (result.success) {
    return createSuccessResult<InstallCommandData>({
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
    })
  }

  return createErrorResult<InstallCommandData>({
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
  })
}

function emitInstallStarted(
  agent: {
    displayName: string
    name: string
  },
  enabled = false,
): void {
  if (!enabled) return

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
}

function toBatchResultItem(agentName: string, result: CommandResult<InstallCommandData>): InstallBatchResultItem {
  const data = result.data
  const warnings = result.warnings.map(warning => ({
    code: warning.code,
    message: warning.message,
  }))

  return {
    agent: data?.agent ?? {
      displayName: agentName,
      name: result.target?.name ?? agentName,
    },
    changed: data?.changed ?? false,
    error: result.error
      ? {
          code: result.error.code,
          message: result.error.message,
        }
      : undefined,
    input: agentName,
    installState: data?.installState,
    installed: data?.installed ?? false,
    ok: result.ok,
    status: getBatchStatus(result),
    warnings,
  }
}

function getBatchStatus(result: CommandResult<InstallCommandData>): InstallBatchStatus {
  if (!result.ok) return result.error?.code === 'RESOURCE_LOCKED' ? 'locked' : 'failed'
  if (result.warnings.some(warning => warning.code === 'TRACKED_EXISTING_INSTALL')) return 'tracked-existing-install'
  if (result.warnings.some(warning => warning.code === 'UNTRACKED_EXISTING_INSTALL'))
    return 'untracked-existing-install'
  if (result.warnings.some(warning => warning.code === 'ALREADY_INSTALLED')) return 'already-installed'
  if (result.warnings.some(warning => warning.code === 'DRY_RUN')) return 'planned'
  return 'installed'
}

function summarizeBatchResults(results: InstallBatchResultItem[]): InstallBatchCommandData['summary'] {
  const summary = {
    alreadyInstalled: 0,
    failed: 0,
    installed: 0,
    locked: 0,
    planned: 0,
    trackedExistingInstall: 0,
    untrackedExistingInstall: 0,
  }

  for (const result of results) {
    switch (result.status) {
      case 'already-installed':
        summary.alreadyInstalled += 1
        break
      case 'failed':
        summary.failed += 1
        break
      case 'installed':
        summary.installed += 1
        break
      case 'locked':
        summary.locked += 1
        break
      case 'planned':
        summary.planned += 1
        break
      case 'tracked-existing-install':
        summary.trackedExistingInstall += 1
        break
      case 'untracked-existing-install':
        summary.untrackedExistingInstall += 1
        break
    }
  }

  return summary
}

function createBatchInstallError(results: InstallBatchResultItem[]): CommandError {
  const failures = results.filter(result => !result.ok)
  const failureCodes = new Set(failures.map(result => result.error?.code))

  if (failureCodes.size === 1 && failureCodes.has('RESOURCE_LOCKED')) {
    return {
      code: 'RESOURCE_LOCKED',
      details: {
        failedAgents: failures.map(result => result.input),
      },
      message:
        'One or more agents could not be installed because another Quantex process is already using the agent lifecycle lock.',
    }
  }

  return {
    code: 'INSTALL_FAILED',
    details: {
      failedAgents: failures.map(result => result.input),
    },
    message: 'One or more agents failed to install.',
  }
}

function renderInstallHuman(result: {
  data?: InstallCommandData
  error: { message: string } | null
  warnings: CommandWarning[]
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

  printInfo(pc.cyan(`Installing ${result.data.agent.displayName}...`))
  printInfo(pc.green(`${result.data.agent.displayName} installed successfully!`))
}

function renderBatchInstallHuman(result: { data?: InstallBatchCommandData; error: { message: string } | null }): void {
  if (!result.data) {
    if (result.error) printError(pc.red(result.error.message))
    return
  }

  for (const item of result.data.results) {
    switch (item.status) {
      case 'installed':
        printInfo(pc.cyan(`Installing ${item.agent.displayName}...`))
        printInfo(pc.green(`${item.agent.displayName} installed successfully!`))
        break
      case 'tracked-existing-install':
        printInfo(pc.green(getFirstMessage(item.warnings, `${item.agent.displayName} is already installed.`)))
        break
      case 'already-installed':
      case 'untracked-existing-install':
        printWarn(pc.yellow(getFirstMessage(item.warnings, `${item.agent.displayName} is already installed.`)))
        break
      case 'planned':
        printWarn(pc.cyan(getFirstMessage(item.warnings, `Dry run: would install ${item.agent.displayName}.`)))
        break
      case 'locked':
        printWarn(
          pc.yellow(item.error?.message ?? `Another quantex process is already installing ${item.agent.displayName}.`),
        )
        break
      case 'failed':
        printError(pc.red(item.error?.message ?? `Failed to install ${item.agent.displayName}.`))
        break
    }
  }

  printBatchInstallSummary(result.data.summary)
}

function getFirstMessage(
  messages: Array<{
    message: string
  }>,
  fallback: string,
): string {
  return messages[0]?.message ?? fallback
}

function printBatchInstallSummary(summary: InstallBatchCommandData['summary']): void {
  const parts = [
    summary.installed ? `installed ${summary.installed}` : undefined,
    summary.alreadyInstalled ? `already installed ${summary.alreadyInstalled}` : undefined,
    summary.trackedExistingInstall ? `tracked existing ${summary.trackedExistingInstall}` : undefined,
    summary.untrackedExistingInstall ? `untracked existing ${summary.untrackedExistingInstall}` : undefined,
    summary.failed ? `failed ${summary.failed}` : undefined,
    summary.locked ? `locked ${summary.locked}` : undefined,
    summary.planned ? `planned ${summary.planned}` : undefined,
  ].filter(Boolean)

  if (parts.length > 0) printInfo(pc.bold(`Summary: ${parts.join(', ')}`))
}
