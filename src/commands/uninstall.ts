import type { CoreUninstallExecutionOutcome } from '../core/uninstall-executor'
import type { CommandResult } from '../output/types'
import type { InstallationEngineRoute } from './installation-routing'
import { getCliContext } from '../cli-context'
import { createCoreUninstallCompatibilityExecutor } from '../core/uninstall-compatibility'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { pc } from '../utils/color'
import { createResourceLockedError } from '../utils/lifecycle-errors'
import { isDryRunEnabled, printError, printInfo, printWarn } from '../utils/user-output'
import { reportInstallationEngineRoute, selectInstallationEngineRoute } from './installation-routing'

interface UninstallCommandData {
  agent: {
    displayName: string
    name: string
  }
  changed: boolean
}

export async function uninstallCommand(agentName: string): Promise<CommandResult<UninstallCommandData>> {
  return await uninstallCommandWithRoute(agentName, selectInstallationEngineRoute('uninstall'))
}

export async function uninstallCommandWithRoute(
  agentName: string,
  route: InstallationEngineRoute,
): Promise<CommandResult<UninstallCommandData>> {
  reportInstallationEngineRoute('uninstall', route)
  const cli = getCliContext()
  const controller = new AbortController()
  if (cli.cancelled) controller.abort('cli-cancelled')
  const executor = createCoreUninstallCompatibilityExecutor()
  const outcome = await executor.execute({
    dryRun: isDryRunEnabled(),
    isCancelled: () => Boolean(cli.cancelled) || controller.signal.aborted,
    name: agentName,
    signal: controller.signal,
    timeoutMs: cli.timeoutMs,
  })
  return emitCommandResult(projectUninstallOutcome(outcome, agentName), renderUninstallHuman)
}

function projectUninstallOutcome(
  outcome: CoreUninstallExecutionOutcome,
  inputName: string,
): CommandResult<UninstallCommandData> {
  switch (outcome.kind) {
    case 'agent-not-found':
      return createErrorResult({
        action: 'uninstall',
        error: {
          code: 'AGENT_NOT_FOUND',
          details: { input: inputName },
          message: `Unknown agent: ${inputName}`,
        },
        target: { kind: 'agent', name: inputName },
      })
    case 'unmanaged':
      return createErrorResult({
        action: 'uninstall',
        data: {
          agent: { displayName: outcome.agent.displayName, name: outcome.agent.name },
          changed: false,
        },
        error: {
          code: 'UNINSTALL_UNMANAGED',
          details: {
            canAutoUninstall: false,
            displayName: outcome.agent.displayName,
            input: inputName,
            lifecycle: 'unmanaged',
            name: outcome.agent.name,
          },
          message: `${outcome.agent.displayName} is not managed by qtx, so qtx cannot auto-uninstall it. Run qtx inspect ${outcome.agent.name} for details.`,
        },
        target: { kind: 'agent', name: outcome.agent.name },
      })
    case 'locked':
      return createErrorResult({
        action: 'uninstall',
        data: {
          agent: { displayName: outcome.agent.displayName, name: outcome.agent.name },
          changed: false,
        },
        ...createResourceLockedError(outcome.lock, { kind: 'agent', name: outcome.agent.name }),
      })
    case 'failed':
      return createErrorResult({
        action: 'uninstall',
        data: {
          agent: { displayName: outcome.agent.displayName, name: outcome.agent.name },
          changed: false,
        },
        error: {
          code: 'UNINSTALL_FAILED',
          details: { lifecycle: outcome.lifecycle },
          message: outcome.message,
        },
        target: { kind: 'agent', name: outcome.agent.name },
      })
    case 'dry-run':
      return createSuccessResult({
        action: 'uninstall',
        data: {
          agent: { displayName: outcome.agent.displayName, name: outcome.agent.name },
          changed: false,
        },
        target: { kind: 'agent', name: outcome.agent.name },
        warnings: [{ code: 'DRY_RUN', message: `Dry run: ${outcome.action}.` }],
      })
    case 'ghost-reconciled':
      return createSuccessResult({
        action: 'uninstall',
        data: {
          agent: { displayName: outcome.agent.displayName, name: outcome.agent.name },
          changed: true,
        },
        target: { kind: 'agent', name: outcome.agent.name },
        warnings: [
          {
            code: 'GHOST_STATE_RECONCILED',
            message: `${outcome.agent.displayName} was already absent; stale lifecycle evidence was removed.`,
          },
        ],
      })
    case 'uninstalled':
      return createSuccessResult({
        action: 'uninstall',
        data: {
          agent: { displayName: outcome.agent.displayName, name: outcome.agent.name },
          changed: true,
        },
        target: { kind: 'agent', name: outcome.agent.name },
      })
  }
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
