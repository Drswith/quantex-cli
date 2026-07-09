import type { AgentDefinition } from '../agents'
import type { CommandResult } from '../output/types'
import type { UninstallLifecycleOutcome } from '../services/uninstall'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { runUninstallLifecycle } from '../services/uninstall'
import { pc } from '../utils/color'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'

interface UninstallCommandData {
  agent: {
    displayName: string
    name: string
  }
  changed: boolean
}

export async function uninstallCommand(agentName: string): Promise<CommandResult<UninstallCommandData>> {
  const outcome = await runUninstallLifecycle(agentName, {
    dryRun: isDryRunEnabled(),
  })

  return emitCommandResult(createUninstallResult(agentName, outcome), renderUninstallHuman)
}

function createUninstallResult(
  agentName: string,
  outcome: UninstallLifecycleOutcome,
): CommandResult<UninstallCommandData> {
  if (outcome.kind === 'agent-not-found') {
    return createErrorResult<UninstallCommandData>({
      action: 'uninstall',
      error: {
        code: 'AGENT_NOT_FOUND',
        details: {
          input: outcome.input,
        },
        message: `Unknown agent: ${outcome.input}`,
      },
      target: {
        kind: 'agent',
        name: agentName,
      },
    })
  }

  const { agent } = outcome
  const target = {
    kind: 'agent' as const,
    name: agent.name,
  }
  const agentData = {
    displayName: agent.displayName,
    name: agent.name,
  }

  switch (outcome.kind) {
    case 'unmanaged':
      return createUnmanagedUninstallResult(outcome.input, agent)
    case 'would-uninstall':
      return createSuccessResult<UninstallCommandData>({
        action: 'uninstall',
        data: {
          agent: agentData,
          changed: false,
        },
        target,
        warnings: [
          {
            code: 'DRY_RUN',
            message: `Dry run: would uninstall ${agent.displayName}.`,
          },
        ],
      })
    case 'uninstalled':
      return createSuccessResult<UninstallCommandData>({
        action: 'uninstall',
        data: {
          agent: agentData,
          changed: true,
        },
        target,
      })
    case 'uninstall-failed':
      return createErrorResult<UninstallCommandData>({
        action: 'uninstall',
        data: {
          agent: agentData,
          changed: false,
        },
        error: {
          code: 'UNINSTALL_FAILED',
          message: `Failed to uninstall ${agent.displayName}.`,
        },
        target,
      })
    case 'resource-locked':
      return createErrorResult<UninstallCommandData>({
        action: 'uninstall',
        data: {
          agent: agentData,
          changed: false,
        },
        ...createResourceLockedError(outcome.error, target),
      })
  }
}

function createUnmanagedUninstallResult(agentName: string, agent: AgentDefinition) {
  return createErrorResult<UninstallCommandData>({
    action: 'uninstall',
    data: {
      agent: {
        displayName: agent.displayName,
        name: agent.name,
      },
      changed: false,
    },
    error: {
      code: 'UNINSTALL_UNMANAGED',
      details: {
        canAutoUninstall: false,
        displayName: agent.displayName,
        input: agentName,
        lifecycle: 'unmanaged',
        name: agent.name,
      },
      message: `${agent.displayName} is not managed by qtx, so qtx cannot auto-uninstall it. Run qtx inspect ${agent.name} for details.`,
    },
    target: {
      kind: 'agent',
      name: agent.name,
    },
  })
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
