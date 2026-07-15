import type { AgentDefinition, InstallMethod } from '../agents/types'
import type { CliErrorCode } from '../errors'
import type { RuntimeFailure } from '../runtime'
import type { AgentExecutionOutcome } from '../services'
import type { ExecInstallPolicy } from './exec'
import process from 'node:process'
import prompts from 'prompts'
import { cancelCliContextOperations, getCliContext } from '../cli-context'
import { cliErrorCodes, getExitCodeForError } from '../errors'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { createProductionLifecycleExecutionService } from '../services'
import { pc } from '../utils/color'
import { formatInstallMethodCommand, formatInstallMethodLabel } from '../utils/install'
import {
  isAssumeYesEnabled,
  isDryRunEnabled,
  printError,
  printInfo,
  printWarn,
  writeDirectOutput,
} from '../utils/user-output'

interface ExecPreflightData {
  agent: {
    binaryName?: string
    displayName?: string
    name: string
  }
  execution: {
    args: string[]
    installGuidance?: {
      docsRef: string
      installMethods: Array<{
        command: string
        label: string
        type: string
      }>
      suggestedAction: 'ensure-agent-installed' | 'rerun-with-install-policy'
      suggestedEnsureCommand: string
      suggestedExecCommand: string
    }
    installPolicy: ExecInstallPolicy | 'prompt'
    installed: boolean
    interactive: boolean
    launched: boolean
  }
}

export interface RunCommandOptions {
  readonly assumeYes?: boolean
  readonly dryRun?: boolean
  readonly install?: ExecInstallPolicy | 'prompt'
  readonly nonInteractive?: boolean
}

export interface RunCommandDependencies {
  readonly cancelOperations: typeof cancelCliContextOperations
  readonly createExecutionService: typeof createProductionLifecycleExecutionService
}

const defaultDependencies: RunCommandDependencies = {
  cancelOperations: cancelCliContextOperations,
  createExecutionService: createProductionLifecycleExecutionService,
}

export async function runCommand(
  agentName: string,
  args: string[],
  options: RunCommandOptions = {},
  dependencies: RunCommandDependencies = defaultDependencies,
): Promise<number> {
  const context = getCliContext()
  const interactive = options.nonInteractive ? false : context.interactive
  const assumeYes = options.assumeYes ?? isAssumeYesEnabled()
  const dryRun = options.dryRun ?? isDryRunEnabled()
  const installPolicy = options.install ?? 'prompt'
  let cancellationSignal: NodeJS.Signals | undefined

  const service = dependencies.createExecutionService({
    confirmInstall: async observed => {
      if (assumeYes) return true
      const response = await prompts({
        initial: true,
        message: `${observed.agent.displayName} is not installed. Would you like to install it?`,
        name: 'install',
        type: 'confirm',
      })
      return Boolean(response.install)
    },
    dryRun,
    interactive,
    onInstallStart: observed => {
      printInfo(pc.cyan(`Installing ${observed.agent.displayName}...`))
    },
    outputMode: context.outputMode,
    timeoutMs: context.timeoutMs,
  })

  const handleSignal = (signal: NodeJS.Signals): void => {
    cancellationSignal ??= signal
    void dependencies.cancelOperations()
  }
  const sigintHandler = (): void => handleSignal('SIGINT')
  const sigtermHandler = (): void => handleSignal('SIGTERM')
  process.once('SIGINT', sigintHandler)
  process.once('SIGTERM', sigtermHandler)

  try {
    const outcome = await service.execute({ agentName, args, installPolicy })
    return presentExecutionOutcome(outcome, {
      agentName,
      args,
      cancellationSignal,
      installPolicy,
      interactive,
    })
  } finally {
    process.off('SIGINT', sigintHandler)
    process.off('SIGTERM', sigtermHandler)
    service.dispose()
  }
}

interface ExecutionPresentationContext {
  readonly agentName: string
  readonly args: string[]
  readonly cancellationSignal?: NodeJS.Signals
  readonly installPolicy: ExecInstallPolicy | 'prompt'
  readonly interactive: boolean
}

function presentExecutionOutcome(outcome: AgentExecutionOutcome, context: ExecutionPresentationContext): number {
  if (outcome.kind === 'not-found') {
    emitExecPreflightError({
      agent: { name: context.agentName },
      errorCode: 'AGENT_NOT_FOUND',
      errorMessage: `Unknown agent: ${context.agentName}`,
      execution: executionData(context, false),
    })
    return getExitCodeForError('AGENT_NOT_FOUND')
  }

  if (outcome.kind === 'observation-failed') {
    return emitExecRuntimeError(context.agentName, outcome.error)
  }

  const { observed } = outcome
  const agent = observed.agent
  if (outcome.kind === 'not-installed' || outcome.kind === 'interaction-required') {
    const interactionRequired = outcome.kind === 'interaction-required'
    emitExecPreflightError({
      agent,
      errorCode: interactionRequired ? 'INTERACTION_REQUIRED' : 'AGENT_NOT_INSTALLED',
      errorMessage: interactionRequired
        ? `${agent.displayName} is not installed and interactive installation is disabled.`
        : `${agent.displayName} is not installed.`,
      execution: {
        ...executionData(context, false),
        installGuidance: createExecInstallGuidance(agent, observed.methods, context.args),
      },
    })
    return getExitCodeForError(interactionRequired ? 'INTERACTION_REQUIRED' : 'AGENT_NOT_INSTALLED')
  }

  switch (outcome.kind) {
    case 'install-declined':
      printWarn(pc.yellow('Installation cancelled.'))
      return 1
    case 'install-failed':
      printError(pc.red(`Failed to install ${agent.displayName}.`))
      return getExitCodeForError('INSTALL_FAILED')
    case 'dry-run':
      if (outcome.wouldInstall) writeDirectOutput(pc.cyan(`Dry run: would install ${agent.displayName}.`))
      emitExecDryRun({
        agent,
        execution: executionData(context, true),
        message: `Dry run: would run ${outcome.argv.join(' ')}`,
      })
      return 0
    case 'launch-failed':
      printError(pc.red(`Failed to launch ${agent.displayName}: ${outcome.reason}`))
      return 1
    case 'cancelled':
      printError(
        pc.red(
          context.cancellationSignal
            ? `${agent.displayName} was cancelled by ${context.cancellationSignal}.`
            : `${agent.displayName} was cancelled.`,
        ),
      )
      return getExitCodeForError('CANCELLED')
    case 'timed-out':
      printError(
        pc.red(
          outcome.phase === 'install'
            ? `Installing ${agent.displayName} timed out after ${outcome.timeoutMs}ms.`
            : `${agent.displayName} timed out after ${outcome.timeoutMs}ms.`,
        ),
      )
      return getExitCodeForError('TIMEOUT')
    case 'exited':
      return outcome.exitCode
  }
}

function executionData(context: ExecutionPresentationContext, installed: boolean): ExecPreflightData['execution'] {
  return {
    args: context.args,
    installPolicy: context.installPolicy,
    installed,
    interactive: context.interactive,
    launched: false,
  }
}

function emitExecRuntimeError(agentName: string, error: RuntimeFailure): number {
  const code = isCliErrorCode(error.code) ? error.code : 'INSTALL_FAILED'
  const context = getCliContext()
  if (context.outputMode === 'human') {
    printError(pc.red(error.message))
  } else {
    emitCommandResult(
      createErrorResult({
        action: 'exec',
        error: { code, details: error.details, message: error.message },
        target: { kind: 'agent', name: agentName },
      }),
      () => {},
    )
  }
  return getExitCodeForError(code)
}

function isCliErrorCode(value: string | undefined): value is CliErrorCode {
  return value !== undefined && (cliErrorCodes as readonly string[]).includes(value)
}

function createExecInstallGuidance(
  agent: {
    binaryName: string
    displayName: string
    name: string
    packages?: AgentDefinition['packages']
  },
  methods: readonly InstallMethod[],
  args: string[],
): ExecPreflightData['execution']['installGuidance'] {
  const installMethods = methods
    .map(method => ({
      command: formatInstallMethodCommand(agent, method),
      label: formatInstallMethodLabel(method),
      type: method.type,
    }))
    .filter(method => method.command)

  return {
    docsRef: 'skills/quantex-cli/references/command-recipes.md',
    installMethods,
    suggestedAction: 'rerun-with-install-policy',
    suggestedEnsureCommand: `quantex ensure ${agent.name}`,
    suggestedExecCommand: ['quantex', 'exec', agent.name, '--install', 'if-missing', '--', ...args].join(' '),
  }
}

function emitExecPreflightError(input: {
  agent: ExecPreflightData['agent']
  errorCode: 'AGENT_NOT_FOUND' | 'AGENT_NOT_INSTALLED' | 'INTERACTION_REQUIRED'
  errorMessage: string
  execution: ExecPreflightData['execution']
}): void {
  const context = getCliContext()
  if (context.outputMode === 'human') {
    printError(pc.red(input.errorMessage))
    const guidance = input.execution.installGuidance
    if (guidance) {
      writeDirectOutput(pc.dim(`Try: ${guidance.suggestedEnsureCommand}`))
      writeDirectOutput(pc.dim(`Or:  ${guidance.suggestedExecCommand}`))
    }
    return
  }

  emitCommandResult(
    createErrorResult<ExecPreflightData>({
      action: 'exec',
      data: { agent: input.agent, execution: input.execution },
      error: {
        code: input.errorCode,
        details: input.execution.installGuidance,
        message: input.errorMessage,
      },
      target: { kind: 'agent', name: input.agent.name },
    }),
    () => {},
  )
}

function emitExecDryRun(input: {
  agent: ExecPreflightData['agent']
  execution: ExecPreflightData['execution']
  message: string
}): void {
  const context = getCliContext()
  if (context.outputMode === 'human') {
    writeDirectOutput(pc.cyan(input.message))
    return
  }

  emitCommandResult(
    createSuccessResult<ExecPreflightData>({
      action: 'exec',
      data: { agent: input.agent, execution: input.execution },
      target: { kind: 'agent', name: input.agent.name },
    }),
    () => {},
  )
}
