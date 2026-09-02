import type { AgentDefinition } from '../agents'
import type { CommandResult } from '../output/types'
import type { InstallationEngineRoute } from './installation-routing'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { resolveAgent } from '../services/agents'
import { resolveAgentObservation } from '../services/lifecycle-observations'
import { pc } from '../utils/color'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { printError, printInfo, printWarn } from '../utils/user-output'
import { reportInstallationEngineRoute, selectInstallationEngineRoute } from './installation-routing'
import { resolveUnmanagedExternalAgent } from './unmanaged-install-compatibility'

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
  return await ensureCommandWithRoute(agentName, selectInstallationEngineRoute('ensure'))
}

export async function ensureCommandWithRoute(
  agentName: string,
  route: InstallationEngineRoute,
): Promise<CommandResult<EnsureCommandData>> {
  reportInstallationEngineRoute('ensure', route)
  if (route.engine === 'dry-run-planning') {
    return emitCommandResult(await planEnsureDryRun(agentName), renderEnsureHuman)
  }

  const unmanaged = await resolveUnmanagedExternalAgent(agentName)
  if (unmanaged) return emitCommandResult(createUnmanagedEnsureResult(unmanaged), renderEnsureHuman)
  const { createCoreInstallationCliSession } = await import('./core-installation-cli')
  const session = createCoreInstallationCliSession('ensure')
  try {
    return emitCommandResult(await session.execute(agentName, { emitStartedEvent: true }), renderEnsureHuman)
  } finally {
    session.dispose()
  }
}

async function planEnsureDryRun(agentName: string): Promise<CommandResult<EnsureCommandData>> {
  if (!resolveAgent(agentName)) {
    return createUnknownAgentResult(agentName)
  }

  const resolved = await resolveAgentObservation(agentName)
  if (!resolved) return createUnknownAgentResult(agentName)

  const { agent } = resolved
  const inPath = resolved.pathExecutable.present
  const installedState = resolved.installedState
  const adoptableMethod =
    inPath && !installedState
      ? getAdoptableExistingInstallMethod(resolved.methods, resolved.resolvedBinaryPath ?? resolved.pathExecutable.path)
      : undefined

  if (inPath && !installedState && !adoptableMethod) return createUnmanagedEnsureResult(agent)
  if (installedState && inPath) return createAlreadyInstalledEnsureResult(agent)
  return createDryRunEnsureResult(agent, Boolean(adoptableMethod), Boolean(installedState))
}

function createUnknownAgentResult(agentName: string): CommandResult<EnsureCommandData> {
  return createErrorResult({
    action: 'ensure',
    error: {
      code: 'AGENT_NOT_FOUND',
      details: { input: agentName },
      message: `Unknown agent: ${agentName}`,
    },
    target: { kind: 'agent', name: agentName },
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
