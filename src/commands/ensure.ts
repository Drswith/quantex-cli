import type { AgentDefinition } from '../agents'
import type { CommandError, CommandResult } from '../output/types'
import {
  type AgentInstallationExecutionValue,
  type AgentInstallationRoute,
  reconcileAgentInstallation,
  reconcileVerifiedMutation,
} from '../lifecycle'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { withAgentLifecycleLock } from '../package-manager'
import { resolveAgent } from '../services/agents'
import { resolveAgentObservation } from '../services/lifecycle-observations'
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
  if (!resolveAgent(agentName) || isDryRunEnabled()) return ensureCommandLocked(agentName)

  try {
    return await withAgentLifecycleLock(() => ensureCommandLocked(agentName))
  } catch (error) {
    if (isResourceLockError(error)) {
      return emitCommandResult(
        createErrorResult<EnsureCommandData>({
          action: 'ensure',
          ...createResourceLockedError(error, { kind: 'agent', name: agentName }),
          target: { kind: 'agent', name: agentName },
        }),
        renderEnsureHuman,
      )
    }
    throw error
  }
}

async function ensureCommandLocked(agentName: string): Promise<CommandResult<EnsureCommandData>> {
  const resolved = await resolveAgentObservation(agentName)
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

  const { agent } = resolved
  const inPath = resolved.pathExecutable.present
  const installedState = resolved.installedState
  const adoptableMethod =
    inPath && !installedState
      ? getAdoptableExistingInstallMethod(resolved.methods, resolved.resolvedBinaryPath ?? resolved.pathExecutable.path)
      : undefined

  if (inPath && !installedState && !adoptableMethod) {
    return emitCommandResult(createUnmanagedEnsureResult(agent), renderEnsureHuman)
  }

  const route: AgentInstallationRoute = installedState && inPath ? 'satisfied' : adoptableMethod ? 'adopt' : 'install'
  if (isDryRunEnabled()) {
    return emitCommandResult(
      route === 'satisfied'
        ? createAlreadyInstalledEnsureResult(agent)
        : createDryRunEnsureResult(agent, route === 'adopt', Boolean(installedState)),
      renderEnsureHuman,
    )
  }

  if (route !== 'satisfied') emitEnsureStarted(agent)

  try {
    const result = await reconcileAgentInstallation({
      adoptableMethod,
      agent,
      observation: { inPath, installedState, lifecycle: resolved.observation, methods: resolved.methods },
      operation: 'ensure',
      route,
    })

    return emitCommandResult(mapEnsureOutcome(agent, route, result), renderEnsureHuman)
  } catch (error) {
    if (isResourceLockError(error)) {
      return emitCommandResult(
        createErrorResult<EnsureCommandData>({
          action: 'ensure',
          data: {
            agent: { displayName: agent.displayName, name: agent.name },
            changed: false,
            installed: inPath,
          },
          ...createResourceLockedError(error, { kind: 'agent', name: agent.name }),
        }),
        renderEnsureHuman,
      )
    }
    throw error
  }
}

function emitEnsureStarted(agent: AgentDefinition): void {
  emitCommandEvent({
    action: 'ensure',
    data: { agent: { displayName: agent.displayName, name: agent.name } },
    target: { kind: 'agent', name: agent.name },
    type: 'started',
  })
}

function createDryRunEnsureResult(
  agent: AgentDefinition,
  adopt: boolean,
  trackedGhost: boolean,
): CommandResult<EnsureCommandData> {
  return createSuccessResult({
    action: 'ensure',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
      installed: adopt,
    },
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'DRY_RUN',
        message: adopt
          ? `Dry run: would record the existing ${agent.displayName} install in Quantex state.`
          : trackedGhost
            ? `Dry run: would reinstall ${agent.displayName} only if its recorded provider target is confirmed absent.`
            : `Dry run: would install ${agent.displayName}.`,
      },
    ],
  })
}

function createAlreadyInstalledEnsureResult(agent: AgentDefinition): CommandResult<EnsureCommandData> {
  return createSuccessResult({
    action: 'ensure',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
      installed: true,
    },
    target: { kind: 'agent', name: agent.name },
    warnings: [{ code: 'ALREADY_INSTALLED', message: `${agent.displayName} is already installed.` }],
  })
}

function createUnmanagedEnsureResult(agent: AgentDefinition): CommandResult<EnsureCommandData> {
  return createSuccessResult({
    action: 'ensure',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
      installed: true,
    },
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'UNTRACKED_EXISTING_INSTALL',
        message: `${agent.displayName} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.`,
      },
    ],
  })
}

function mapEnsureOutcome(
  agent: AgentDefinition,
  route: AgentInstallationRoute,
  outcome: Awaited<ReturnType<typeof reconcileVerifiedMutation<AgentInstallationExecutionValue>>>,
): CommandResult<EnsureCommandData> {
  if (outcome.kind === 'success') {
    if (route === 'satisfied') return createAlreadyInstalledEnsureResult(agent)

    const installedState = outcome.value.value.installedState
    return createSuccessResult({
      action: 'ensure',
      data: {
        agent: { displayName: agent.displayName, name: agent.name },
        changed: outcome.value.changed,
        installState: outcome.value.changed
          ? { installType: installedState.installType, packageName: installedState.packageName }
          : undefined,
        installed: true,
      },
      target: { kind: 'agent', name: agent.name },
      warnings:
        route === 'adopt'
          ? [
              {
                code: 'TRACKED_EXISTING_INSTALL',
                message: `${agent.displayName} is already installed. Quantex is now tracking the existing install.`,
              },
            ]
          : [],
    })
  }

  const error: CommandError =
    outcome.kind === 'cancelled'
      ? { code: 'CANCELLED', message: 'Ensure was cancelled before tracking could complete.' }
      : outcome.kind === 'failed' && outcome.reason === 'receipt-write-failed'
        ? {
            code: 'INSTALL_FAILED',
            details: { lifecycle: 'state-write-failed' },
            message: `Failed to record verified state for ${agent.displayName}.`,
          }
        : (outcome.kind === 'failed' && outcome.reason.endsWith('-after-ensure')) || outcome.kind === 'indeterminate'
          ? {
              code: 'INSTALL_FAILED',
              details: { lifecycle: 'verification-failed' },
              message: `${agent.displayName} could not be verified after ensure completed.`,
            }
          : { code: 'INSTALL_FAILED', message: `Failed to install ${agent.displayName}.` }

  return createErrorResult({
    action: 'ensure',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
      installed: false,
    },
    error,
    target: { kind: 'agent', name: agent.name },
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
