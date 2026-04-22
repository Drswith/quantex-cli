import type { SpawnHandle } from '../utils/child-process'
import type { ExecInstallPolicy } from './exec'
import process from 'node:process'
import pc from 'picocolors'
import prompts from 'prompts'
import { cancelCliContextOperations, getCliContext } from '../cli-context'
import { getExitCodeForError } from '../errors'
import { installAgent } from '../package-manager'
import { resolveAgentInspection } from '../services/agents'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../utils/child-process'
import { isResourceLockError } from '../utils/lock'

export async function runCommand(
  agentName: string,
  args: string[],
  options: {
    install?: ExecInstallPolicy | 'prompt'
    nonInteractive?: boolean
  } = {},
): Promise<number> {
  const resolved = await resolveAgentInspection(agentName)
  if (!resolved) {
    console.log(pc.red(`Unknown agent: ${agentName}`))
    return getExitCodeForError('AGENT_NOT_FOUND')
  }

  const { agent, inspection } = resolved
  const interactive = options.nonInteractive ? false : getCliContext().interactive
  const installPolicy = options.install ?? 'prompt'

  if (!inspection.inPath) {
    if (installPolicy === 'never') {
      console.log(pc.red(`${agent.displayName} is not installed.`))
      return getExitCodeForError('AGENT_NOT_INSTALLED')
    }

    if (installPolicy === 'if-missing' || installPolicy === 'always') {
      console.log(pc.cyan(`Installing ${agent.displayName}...`))
      const result = await tryInstallForRun(agent)
      if (!result.success) {
        console.log(pc.red(`Failed to install ${agent.displayName}.`))
        return 1
      }
    }
    else if (!interactive) {
      console.log(pc.red(`${agent.displayName} is not installed and interactive installation is disabled.`))
      return getExitCodeForError('INTERACTION_REQUIRED')
    }
    else {
      const response = await prompts({
        type: 'confirm',
        name: 'install',
        message: `${agent.displayName} is not installed. Would you like to install it?`,
        initial: true,
      })

      if (!response.install) {
        console.log(pc.yellow('Installation cancelled.'))
        return 1
      }

      console.log(pc.cyan(`Installing ${agent.displayName}...`))
      const result = await tryInstallForRun(agent)
      if (!result.success) {
        console.log(pc.red(`Failed to install ${agent.displayName}.`))
        return 1
      }
    }
  }

  try {
    return await runSpawnedAgentProcess(spawnWithQuantexStdio([agent.binaryName, ...args]), agent.displayName)
  }
  catch (e) {
    console.log(pc.red(`Failed to launch ${agent.displayName}: ${e instanceof Error ? e.message : String(e)}`))
    return 1
  }
}

async function tryInstallForRun(agent: { displayName: string } & Parameters<typeof installAgent>[0]): Promise<Awaited<ReturnType<typeof installAgent>>> {
  try {
    return await installAgent(agent)
  }
  catch (error) {
    if (isResourceLockError(error)) {
      console.log(pc.red(error.message))
      return { success: false }
    }

    console.log(pc.red(`Failed to install ${agent.displayName}: ${error instanceof Error ? error.message : String(error)}`))
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
        console.log(pc.red(`${displayName} was cancelled by ${signal}.`))
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
            console.log(pc.red(`${displayName} timed out after ${timeoutMs}ms.`))
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
