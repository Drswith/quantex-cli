import type { AgentDefinition } from '../agents'
import type { CommandError, CommandResult, CommandWarning } from '../output/types'
import type { CoreInstallationCliSession } from './core-installation-cli'
import type { InstallationEngineRoute } from './installation-routing'
import { getCliContext } from '../cli-context'
import { normalizeAgentPresenceTargets } from '../idempotency/lifecycle-policy'
import { createErrorResult, createSuccessResult, emitCommandEvent, emitCommandResult } from '../output'
import { resolveAgent } from '../services/agents'
import { resolveAgentObservation } from '../services/lifecycle-observations'
import { pc } from '../utils/color'
import { getAdoptableExistingInstallMethod } from '../utils/install'
import { printError, printInfo, printWarn } from '../utils/user-output'
import { reportInstallationEngineRoute, selectInstallationEngineRoute } from './installation-routing'
import { resolveUnmanagedExternalAgent } from './unmanaged-install-compatibility'

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
  return await installCommandWithRoute(agentNames, selectInstallationEngineRoute('install'))
}

export async function installCommandWithRoute(
  agentNames: string | string[],
  route: InstallationEngineRoute,
): Promise<CommandResult<InstallBatchCommandData | InstallCommandData>> {
  reportInstallationEngineRoute('install', route)
  if (route.engine === 'dry-run-planning') {
    return await runInstallCommand(agentNames, undefined)
  }
  const { createCoreInstallationCliSession } = await import('./core-installation-cli')
  const coreSession = createCoreInstallationCliSession('install')
  try {
    return await runInstallCommand(agentNames, coreSession)
  } finally {
    coreSession.dispose()
  }
}

async function runInstallCommand(
  agentNames: string | string[],
  coreSession: CoreInstallationCliSession | undefined,
): Promise<CommandResult<InstallBatchCommandData | InstallCommandData>> {
  const requestedAgents = normalizeAgentPresenceTargets(Array.isArray(agentNames) ? agentNames : [agentNames])

  if (requestedAgents.length <= 1) {
    const singleResult = await performSingleInstall(requestedAgents[0]!, { emitStartedEvent: true }, coreSession)
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
    if (getCliContext().cancelled) break

    const singleResult = await performSingleInstall(agentName, {}, coreSession)
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

    if (getCliContext().cancelled) break
  }

  const data: InstallBatchCommandData = {
    results,
    scope: 'batch',
    summary: summarizeBatchResults(results),
  }

  if (getCliContext().cancelled && results.length < requestedAgents.length) {
    return emitCommandResult(
      createErrorResult<InstallBatchCommandData>({
        action: 'install',
        data,
        error: {
          code: 'CANCELLED',
          message: 'Install was cancelled before all agents could be installed.',
        },
        target: {
          kind: 'agent',
        },
      }),
      renderBatchInstallHuman,
    )
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
  coreSession: CoreInstallationCliSession | undefined,
): Promise<CommandResult<InstallCommandData>> {
  if (!coreSession) return planInstallDryRun(agentName)
  const unmanaged = await resolveUnmanagedExternalAgent(agentName)
  return unmanaged ? createUnmanagedInstallResult(unmanaged) : await coreSession.execute(agentName, options)
}

async function planInstallDryRun(agentName: string): Promise<CommandResult<InstallCommandData>> {
  if (!resolveAgent(agentName)) {
    return createUnknownInstallResult(agentName)
  }

  const resolved = await resolveAgentObservation(agentName)
  if (!resolved) return createUnknownInstallResult(agentName)

  const { agent } = resolved
  const inPath = resolved.pathExecutable.present
  const installedState = resolved.installedState
  const adoptableMethod =
    inPath && !installedState
      ? getAdoptableExistingInstallMethod(resolved.methods, resolved.resolvedBinaryPath ?? resolved.pathExecutable.path)
      : undefined

  if (inPath && !installedState && !adoptableMethod) return createUnmanagedInstallResult(agent)
  if (installedState && inPath) {
    return createSuccessResult({
      action: 'install',
      data: {
        agent: { displayName: agent.displayName, name: agent.name },
        changed: false,
        installed: true,
      },
      target: { kind: 'agent', name: agent.name },
      warnings: [{ code: 'ALREADY_INSTALLED', message: `${agent.displayName} is already installed.` }],
    })
  }

  return createSuccessResult({
    action: 'install',
    data: {
      agent: { displayName: agent.displayName, name: agent.name },
      changed: false,
      installed: Boolean(adoptableMethod),
    },
    target: { kind: 'agent', name: agent.name },
    warnings: [
      {
        code: 'DRY_RUN',
        message: adoptableMethod
          ? `Dry run: would record the existing ${agent.displayName} install in Quantex state.`
          : installedState
            ? `Dry run: would reinstall ${agent.displayName} only if its recorded provider target is confirmed absent.`
            : `Dry run: would install ${agent.displayName}.`,
      },
    ],
  })
}

function createUnknownInstallResult(agentName: string): CommandResult<InstallCommandData> {
  return createErrorResult({
    action: 'install',
    error: {
      code: 'AGENT_NOT_FOUND',
      details: { input: agentName },
      message: `Unknown agent: ${agentName}`,
    },
    target: { kind: 'agent', name: agentName },
  })
}

function createUnmanagedInstallResult(agent: AgentDefinition): CommandResult<InstallCommandData> {
  return createSuccessResult({
    action: 'install',
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
