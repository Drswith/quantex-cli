import type { CommandResult, CommandTarget } from '../output/types'
import type { StableCommandName } from './registry'
import process from 'node:process'
import {
  executeCommandWithRuntime,
  type CommandIdempotencyPolicy,
  type CommandIdempotencyPolicyFactory,
} from '../command-runtime'
import { runCommand } from '../commands/run'
import {
  createAgentAbsenceIdempotencyPolicy,
  createAgentBatchPresenceIdempotencyPolicy,
  createAgentPresenceIdempotencyPolicy,
  normalizeAgentPresenceTargets,
} from '../idempotency/lifecycle-policy'
import { pc } from '../utils/color'

export type CommandActionHandler = (...args: unknown[]) => Promise<void>

const commandActionHandlers: Record<StableCommandName, CommandActionHandler> = {
  capabilities: async () => {
    const { capabilitiesCommand } = await import('../commands/capabilities')
    await setCliExitCode({
      action: 'capabilities',
      run: () => capabilitiesCommand(),
      target: { kind: 'system', name: 'capabilities' },
    })
  },
  commands: async () => {
    const { commandsCommand } = await import('../commands/commands')
    await setCliExitCode({
      action: 'commands',
      run: () => commandsCommand(),
      target: { kind: 'system', name: 'commands' },
    })
  },
  config: async (...args) => {
    const { configCommand } = await import('../commands/config')
    const [action, key, value] = args as [string | undefined, string | undefined, string | undefined]
    await setCliExitCode({
      action: 'config',
      run: () => configCommand(action, key, value),
      target: { kind: 'config', name: key },
    })
  },
  doctor: async () => {
    const { doctorCommand } = await import('../commands/doctor')
    await setCliExitCode({
      action: 'doctor',
      run: () => doctorCommand(),
      target: { kind: 'system', name: 'doctor' },
    })
  },
  ensure: async (...args) => {
    const agent = args[0] as string
    const [{ ensureCommandWithRoute }, { selectInstallationEngineRoute }] = await Promise.all([
      import('../commands/ensure'),
      import('../commands/installation-routing'),
    ])
    const route = selectInstallationEngineRoute('ensure')
    await setCliExitCode({
      action: 'ensure',
      idempotencyPolicy: () => createAgentPresenceIdempotencyPolicy('ensure', agent),
      run: () => ensureCommandWithRoute(agent, route),
      target: { kind: 'agent', name: agent },
    })
  },
  exec: async (...args) => {
    const [agent, fallbackArgs, rawOptions, rawCommand] = args as [
      string,
      string[],
      { install?: string },
      ExecCommandInput,
    ]
    const installPolicy = rawOptions.install ?? 'never'
    if (installPolicy !== 'never' && installPolicy !== 'if-missing' && installPolicy !== 'always') {
      process.stdout.write(`${pc.red(`Unknown install policy: ${installPolicy}`)}\n`)
      process.exitCode = 2
      return
    }

    const passthroughArgs = extractExecPassthroughArgs(rawCommand)
    process.exitCode = await runCommand(agent, passthroughArgs.length > 0 ? passthroughArgs : fallbackArgs, {
      install: installPolicy,
      nonInteractive: rawCommand.optsWithGlobals().nonInteractive,
    })
  },
  info: async (...args) => {
    const agent = args[0] as string
    const { infoCommand } = await import('../commands/info')
    await setCliExitCode({
      action: 'info',
      run: () => infoCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  },
  inspect: async (...args) => {
    const agent = args[0] as string
    const { inspectCommand } = await import('../commands/inspect')
    await setCliExitCode({
      action: 'inspect',
      run: () => inspectCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  },
  install: async (...args) => {
    const [{ installCommandWithRoute }, { selectInstallationEngineRoute }] = await Promise.all([
      import('../commands/install'),
      import('../commands/installation-routing'),
    ])
    const route = selectInstallationEngineRoute('install')
    const normalizedAgents = normalizeAgentPresenceTargets(args[0] as string[])
    const isSingleAgent = normalizedAgents.length === 1
    await setCliExitCode({
      action: 'install',
      ...(isSingleAgent
        ? { idempotencyPolicy: () => createAgentPresenceIdempotencyPolicy('install', normalizedAgents[0]!) }
        : { idempotencyPolicy: () => createAgentBatchPresenceIdempotencyPolicy(normalizedAgents) }),
      run: () => installCommandWithRoute(normalizedAgents, route),
      target: isSingleAgent
        ? { kind: 'agent', name: normalizedAgents[0] }
        : { kind: 'agent', name: normalizedAgents.join(',') },
    })
  },
  list: async () => {
    const { listCommand } = await import('../commands/list')
    await setCliExitCode({
      action: 'list',
      run: () => listCommand(),
      target: { kind: 'system', name: 'agents' },
    })
  },
  resolve: async (...args) => {
    const agent = args[0] as string
    const { resolveCommand } = await import('../commands/resolve')
    await setCliExitCode({
      action: 'resolve',
      run: () => resolveCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  },
  schema: async (...args) => {
    const command = args[0] as string | undefined
    const { schemaCommand } = await import('../commands/schema')
    await setCliExitCode({
      action: 'schema',
      run: () => schemaCommand(command),
      target: { kind: 'system', name: 'schema' },
    })
  },
  uninstall: async (...args) => {
    const agent = args[0] as string
    const { uninstallCommand } = await import('../commands/uninstall')
    await setCliExitCode({
      action: 'uninstall',
      idempotencyPolicy: () => createAgentAbsenceIdempotencyPolicy(agent),
      run: () => uninstallCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  },
  update: async (...args) => {
    const [agent, options] = args as [string | undefined, { all?: boolean }]
    const { createUpdateCommandInvocation } = await import('../commands/update')
    const invocation = createUpdateCommandInvocation(agent, options.all ?? false)
    try {
      await setCliExitCode({
        action: 'update',
        ...(invocation.idempotencyPolicy ? { idempotencyPolicy: invocation.idempotencyPolicy } : {}),
        run: invocation.run,
        target: { kind: 'agent', name: agent },
      })
    } finally {
      invocation.dispose()
    }
  },
  upgrade: async (...args) => {
    const options = args[0] as { channel?: string; check?: boolean }
    const { resolveUpgradeChannelOption, upgradeCommand } = await import('../commands/upgrade')
    await setCliExitCode({
      action: 'upgrade',
      run: () =>
        upgradeCommand({
          channel: resolveUpgradeChannelOption(options.channel),
          check: options.check ?? false,
        }),
      target: { kind: 'self', name: 'quantex' },
    })
  },
}

export function getCommandActionHandler(commandName: StableCommandName): CommandActionHandler {
  return commandActionHandlers[commandName]
}

interface ExecCommandInput {
  readonly args: string[]
  optsWithGlobals(): { nonInteractive?: boolean }
  readonly processedArgs: unknown[]
}

function extractExecPassthroughArgs(command: ExecCommandInput): string[] {
  const rawArgs = command.processedArgs.at(-1)
  if (Array.isArray(rawArgs)) return rawArgs
  return command.args.slice(1)
}

async function setCliExitCode<T>(options: {
  action: string
  idempotencyPolicy?: CommandIdempotencyPolicy<T> | CommandIdempotencyPolicyFactory<T>
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}): Promise<void> {
  const { getExitCodeForResult } = await import('../errors')
  const result = await executeCommandWithRuntime(options)
  process.exitCode = getExitCodeForResult(result)
}
