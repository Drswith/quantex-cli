import type { CommandResult } from '../output/types'
import type { InstallEnsureLifecycleOutcome } from '../services/install-ensure'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { runInstallEnsureLifecycle } from '../services/install-ensure'
import { pc } from '../utils/color'
import { createResourceLockedError } from '../utils/lifecycle-errors'
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
  const outcome = await runInstallEnsureLifecycle(agentName, {
    dryRun: isDryRunEnabled(),
    onMutationStart: emitEnsureStarted,
  })

  return emitCommandResult(createEnsureResult(agentName, outcome), renderEnsureHuman)
}

function createEnsureResult(
  agentName: string,
  outcome: InstallEnsureLifecycleOutcome,
): CommandResult<EnsureCommandData> {
  if (outcome.kind === 'agent-not-found') {
    return createErrorResult<EnsureCommandData>({
      action: 'ensure',
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
    case 'already-installed':
      return createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: false,
          installed: true,
        },
        target,
        warnings: [
          {
            code: 'ALREADY_INSTALLED',
            message: `${agent.displayName} is already installed.`,
          },
        ],
      })
    case 'would-track-existing':
      return createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: false,
          installed: true,
        },
        target,
        warnings: [
          {
            code: 'DRY_RUN',
            message: `Dry run: would record the existing ${agent.displayName} install in Quantex state.`,
          },
        ],
      })
    case 'tracked-existing':
      return createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: true,
          installState: {
            installType: outcome.installedState.installType,
            packageName: outcome.installedState.packageName,
          },
          installed: true,
        },
        target,
        warnings: [
          {
            code: 'TRACKED_EXISTING_INSTALL',
            message: `${agent.displayName} is already installed. Quantex is now tracking the existing install.`,
          },
        ],
      })
    case 'tracking-cancelled':
      return createErrorResult<EnsureCommandData>({
        action: 'ensure',
        error: {
          code: 'CANCELLED',
          message: 'Ensure was cancelled before tracking could complete.',
        },
        target,
      })
    case 'untracked-existing':
      return createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: false,
          installed: true,
        },
        target,
        warnings: [
          {
            code: 'UNTRACKED_EXISTING_INSTALL',
            message: `${agent.displayName} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.`,
          },
        ],
      })
    case 'would-install':
      return createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: false,
          installed: false,
        },
        target,
        warnings: [
          {
            code: 'DRY_RUN',
            message: `Dry run: would install ${agent.displayName}.`,
          },
        ],
      })
    case 'installed':
      return createSuccessResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: true,
          installState: outcome.installedState
            ? {
                installType: outcome.installedState.installType,
                packageName: outcome.installedState.packageName,
              }
            : undefined,
          installed: true,
        },
        target,
      })
    case 'install-failed':
      return createErrorResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: false,
          installed: false,
        },
        error: {
          code: 'INSTALL_FAILED',
          message: `Failed to install ${agent.displayName}.`,
        },
        target,
      })
    case 'resource-locked':
      return createErrorResult<EnsureCommandData>({
        action: 'ensure',
        data: {
          agent: agentData,
          changed: false,
          installed: outcome.installed,
        },
        ...createResourceLockedError(outcome.error, target),
      })
  }
}

function emitEnsureStarted(agent: { displayName: string; name: string }): void {
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
