import type { SpawnHandle } from '../utils/child-process'
import type { ExecInstallPolicy } from './exec'
import process from 'node:process'
import prompts from 'prompts'
import { cancelCliContextOperations, getCliContext } from '../cli-context'
import { getExitCodeForError } from '../errors'
import { installAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'
import { pc } from '../utils/color'
import { isResourceLockError } from '../utils/lock'
import { isAssumeYesEnabled, isDryRunEnabled, printError, printInfo, printWarn, writeDirectOutput } from '../utils/user-output'

export async function runCommand(
  agentName: string,
  args: string[],
  options: {
    assumeYes?: boolean
    dryRun?: boolean
    install?: ExecInstallPolicy | 'prompt'
    nonInteractive?: boolean
  } = {},
): Promise<number> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    printError(pc.red(`Unknown agent: ${agentName}`))
    return getExitCodeForError('AGENT_NOT_FOUND')
  }

  const { agent, inspection } = resolved
  const interactive = options.nonInteractive ? false : getCliContext().interactive
  const assumeYes = options.assumeYes ?? isAssumeYesEnabled()
  const dryRun = options.dryRun ?? isDryRunEnabled()
  const installPolicy = options.install ?? 'prompt'

  if (!inspection.inPath) {
    if (installPolicy === 'never') {
      printError(pc.red(`${agent.displayName} is not installed.`))
      return getExitCodeForError('AGENT_NOT_INSTALLED')
    }

    if (installPolicy === 'if-missing' || installPolicy === 'always') {
      if (dryRun) {
        writeDirectOutput(pc.cyan(`Dry run: would install ${agent.displayName}.`))
      }
      else {
        printInfo(pc.cyan(`Installing ${agent.displayName}...`))
      }
      const result = await tryInstallForRun(agent, dryRun)
      if (!result.success) {
        printError(pc.red(`Failed to install ${agent.displayName}.`))
        return 1
      }
    }
    else if (!interactive) {
      printError(pc.red(`${agent.displayName} is not installed and interactive installation is disabled.`))
      return getExitCodeForError('INTERACTION_REQUIRED')
    }
    else {
      const response = assumeYes || dryRun
        ? { install: true }
        : await prompts({
            type: 'confirm',
            name: 'install',
            message: `${agent.displayName} is not installed. Would you like to install it?`,
            initial: true,
          })

      if (!response.install) {
        printWarn(pc.yellow('Installation cancelled.'))
        return 1
      }

      if (dryRun) {
        writeDirectOutput(pc.cyan(`Dry run: would install ${agent.displayName}.`))
      }
      else {
        printInfo(pc.cyan(`Installing ${agent.displayName}...`))
      }
      const result = await tryInstallForRun(agent, dryRun)
      if (!result.success) {
        printError(pc.red(`Failed to install ${agent.displayName}.`))
        return 1
      }
    }
  }

  if (dryRun) {
    writeDirectOutput(pc.cyan(`Dry run: would run ${[agent.binaryName, ...args].join(' ')}`))
    return 0
  }

  try {
    return await runSpawnedAgentProcess(spawnWithQuantexStdio([agent.binaryName, ...args]), agent.displayName)
  }
  catch (e) {
    printError(pc.red(`Failed to launch ${agent.displayName}: ${e instanceof Error ? e.message : String(e)}`))
    return 1
  }
}

async function tryInstallForRun(
  agent: { displayName: string } & Parameters<typeof installAgent>[0],
  dryRun: boolean = isDryRunEnabled(),
): Promise<Awaited<ReturnType<typeof installAgent>>> {
  if (dryRun)
    return { success: true }

  try {
    return await installAgent(agent)
  }
  catch (error) {
    if (isResourceLockError(error)) {
      printError(pc.red(error.message))
      return { success: false }
    }

    printError(pc.red(`Failed to install ${agent.displayName}: ${error instanceof Error ? error.message : String(error)}`))
    return { success: false }
  }
}

async function runSpawnedAgentProcess(handle: SpawnHandle, displayName: string): Promise<number> {
  const { timeoutMs } = getCliContext()
  let cleanup: (() => void) | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const signalPromise = new Promise<number>((resolve) => {
      const handleSignal = (signal: NodeJS.Signals): void => {
        cancelCliContextOperations()
        printError(pc.red(`${displayName} was cancelled by ${signal}.`))
        resolve(getExitCodeForError('CANCELLED'))
      }

      const sigintHandler = (): void => handleSignal('SIGINT')
      const sigtermHandler = (): void => handleSignal('SIGTERM')
      process.once('SIGINT', sigintHandler)
      process.once('SIGTERM', sigtermHandler)
      cleanup = (): void => {
        process.off('SIGINT', sigintHandler)
        process.off('SIGTERM', sigtermHandler)
      }
    })

    const timeoutPromise = timeoutMs === undefined
      ? undefined
      : new Promise<number>((resolve) => {
          timeoutId = setTimeout(() => {
            cancelCliContextOperations()
            printError(pc.red(`${displayName} timed out after ${timeoutMs}ms.`))
            resolve(getExitCodeForError('TIMEOUT'))
          }, timeoutMs)
        })

    return await Promise.race([
      waitForSpawnedCommand(handle),
      signalPromise,
      ...(timeoutPromise ? [timeoutPromise] : []),
    ])
  }
  finally {
    if (timeoutId)
      clearTimeout(timeoutId)
    cleanup?.()
  }
}
