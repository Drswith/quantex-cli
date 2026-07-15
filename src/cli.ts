#!/usr/bin/env node

import type { CommandResult, CommandTarget } from './output/types'
import { program } from 'commander'
import process from 'node:process'
import { getAgentByNameOrAlias } from './agents'
import { resetCliContext, resolveCliContext, setCliContext } from './cli-context'
import {
  executeCommandWithRuntime,
  type CommandIdempotencyPolicy,
  type CommandIdempotencyPolicyFactory,
} from './command-runtime'
import { runCommand } from './commands/run'
import { resolveShortcutInvocation } from './commands/shortcut'
import { getExitCodeForResult } from './errors'
import {
  createAgentAbsenceIdempotencyPolicy,
  createAgentBatchPresenceIdempotencyPolicy,
  createAgentPresenceIdempotencyPolicy,
  normalizeAgentPresenceTargets,
} from './idempotency/lifecycle-policy'
import { getSelfVersion } from './self'
import { pc } from './utils/color'

program
  .name('quantex')
  .description('统一的 AI Agent CLI 管理工具')
  .option('--json', 'Output structured JSON')
  .option('--output <mode>', 'Output mode: human, json, or ndjson')
  .option('--non-interactive', 'Disable interactive prompts and confirmations')
  .option('--yes', 'Automatically accept safe default confirmations')
  .option('--quiet', 'Suppress non-essential human logs')
  .option('--color <mode>', 'Color mode: auto, always, or never')
  .option('--log-level <level>', 'Log level: silent, error, warn, info, or debug')
  .option('--dry-run', 'Show what would happen without making changes')
  .option('--refresh', 'Refresh cached version metadata before returning results')
  .option('--no-cache', 'Bypass the local version cache for this command')
  .option('--run-id <id>', 'Attach a run id to structured output and logs')
  .option('--idempotency-key <key>', 'Deduplicate repeated mutating requests by client-supplied key')
  .option('--timeout <duration>', 'Abort a command after the given duration, e.g. 500ms, 30s, 5m')
  .version(getSelfVersion())

program.hook('preAction', (_command, actionCommand) => {
  try {
    setCliContext(resolveCliContext(actionCommand.optsWithGlobals()))
  } catch (error) {
    console.log(pc.red(error instanceof Error ? error.message : String(error)))
    process.exit(2)
  }
})

program.hook('postAction', () => {
  resetCliContext()
})

program
  .command('schema')
  .argument('[command]', 'Optional command name')
  .description('查看结构化输出 schema')
  .action(async (command?: string) => {
    const { schemaCommand } = await import('./commands/schema')
    process.exitCode = await executeCliCommand({
      action: 'schema',
      run: () => schemaCommand(command),
      target: { kind: 'system', name: 'schema' },
    })
  })

program
  .command('commands')
  .description('查看命令目录与稳定能力')
  .action(async () => {
    const { commandsCommand } = await import('./commands/commands')
    process.exitCode = await executeCliCommand({
      action: 'commands',
      run: () => commandsCommand(),
      target: { kind: 'system', name: 'commands' },
    })
  })

program
  .command('capabilities')
  .description('查看当前环境与 surface 能力')
  .action(async () => {
    const { capabilitiesCommand } = await import('./commands/capabilities')
    process.exitCode = await executeCliCommand({
      action: 'capabilities',
      run: () => capabilitiesCommand(),
      target: { kind: 'system', name: 'capabilities' },
    })
  })

program
  .command('inspect <agent>')
  .description('查看 agent 结构化状态')
  .action(async (agent: string) => {
    const { inspectCommand } = await import('./commands/inspect')
    process.exitCode = await executeCliCommand({
      action: 'inspect',
      run: () => inspectCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('resolve <agent>')
  .description('解析 agent 可执行入口')
  .action(async (agent: string) => {
    const { resolveCommand } = await import('./commands/resolve')
    process.exitCode = await executeCliCommand({
      action: 'resolve',
      run: () => resolveCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('install <agents...>')
  .alias('i')
  .description('安装指定 agent')
  .action(async (agents: string[]) => {
    const { installCommand } = await import('./commands/install')
    const normalizedAgents = normalizeAgentPresenceTargets(agents)
    const isSingleAgent = normalizedAgents.length === 1
    process.exitCode = await executeCliCommand({
      action: 'install',
      ...(isSingleAgent
        ? { idempotencyPolicy: () => createAgentPresenceIdempotencyPolicy('install', normalizedAgents[0]!) }
        : { idempotencyPolicy: () => createAgentBatchPresenceIdempotencyPolicy(normalizedAgents) }),
      run: () => installCommand(normalizedAgents),
      target: isSingleAgent
        ? { kind: 'agent', name: normalizedAgents[0] }
        : { kind: 'agent', name: normalizedAgents.join(',') },
    })
  })

program
  .command('ensure <agent>')
  .description('确保指定 agent 已安装')
  .action(async (agent: string) => {
    const { ensureCommand } = await import('./commands/ensure')
    process.exitCode = await executeCliCommand({
      action: 'ensure',
      idempotencyPolicy: () => createAgentPresenceIdempotencyPolicy('ensure', agent),
      run: () => ensureCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('exec <agent>')
  .description('以显式策略启动 agent')
  .allowUnknownOption()
  .option('--install <policy>', 'Install policy: never, if-missing, always', 'never')
  .argument('[args...]', 'Arguments passed through to the agent')
  .action(async (agent: string, args: string[], options: { install?: string }, command) => {
    const installPolicy = options.install
    if (installPolicy !== 'never' && installPolicy !== 'if-missing' && installPolicy !== 'always') {
      console.log(pc.red(`Unknown install policy: ${installPolicy}`))
      process.exitCode = 2
      return
    }

    const passthroughArgs = extractExecPassthroughArgs(command)
    process.exitCode = await runCommand(agent, passthroughArgs.length > 0 ? passthroughArgs : args, {
      install: installPolicy,
      nonInteractive: command.optsWithGlobals().nonInteractive,
    })
  })

program
  .command('update')
  .argument('[agent]', 'Agent name or alias')
  .option('--all', '更新所有已安装的 agent')
  .alias('u')
  .description('更新指定 agent')
  .action(async (agent: string | undefined, options: { all?: boolean }) => {
    const { createUpdateCommandInvocation } = await import('./commands/update')
    const invocation = createUpdateCommandInvocation(agent, options.all ?? false)
    try {
      process.exitCode = await executeCliCommand({
        action: 'update',
        ...(invocation.idempotencyPolicy ? { idempotencyPolicy: invocation.idempotencyPolicy } : {}),
        run: invocation.run,
        target: { kind: 'agent', name: agent },
      })
    } finally {
      invocation.dispose()
    }
  })

program
  .command('uninstall <agent>')
  .alias('rm')
  .description('卸载指定 agent')
  .action(async (agent: string) => {
    const { uninstallCommand } = await import('./commands/uninstall')
    process.exitCode = await executeCliCommand({
      action: 'uninstall',
      idempotencyPolicy: () => createAgentAbsenceIdempotencyPolicy(agent),
      run: () => uninstallCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('list')
  .alias('ls')
  .description('列出所有支持的 agent')
  .action(async () => {
    const { listCommand } = await import('./commands/list')
    process.exitCode = await executeCliCommand({
      action: 'list',
      run: () => listCommand(),
      target: { kind: 'system', name: 'agents' },
    })
  })

program
  .command('info <agent>')
  .description('查看 agent 详细信息')
  .action(async (agent: string) => {
    const { infoCommand } = await import('./commands/info')
    process.exitCode = await executeCliCommand({
      action: 'info',
      run: () => infoCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('config')
  .argument('[action]', 'Action: get, set, reset')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value')
  .description('配置管理')
  .action(async (action?: string, key?: string, value?: string) => {
    const { configCommand } = await import('./commands/config')
    process.exitCode = await executeCliCommand({
      action: 'config',
      run: () => configCommand(action, key, value),
      target: { kind: 'config', name: key },
    })
  })

program
  .command('upgrade')
  .description('升级 Quantex CLI')
  .option('--channel <channel>', 'Update channel: stable or beta')
  .option('--check', 'Only check whether an update is available')
  .action(async (options: { channel?: string; check?: boolean }) => {
    const { upgradeCommand } = await import('./commands/upgrade')
    process.exitCode = await executeCliCommand({
      action: 'upgrade',
      run: () =>
        upgradeCommand({
          channel: options.channel === 'beta' ? 'beta' : undefined,
          check: options.check ?? false,
        }),
      target: { kind: 'self', name: 'quantex' },
    })
  })

program
  .command('doctor')
  .description('检查环境')
  .action(async () => {
    const { doctorCommand } = await import('./commands/doctor')
    process.exitCode = await executeCliCommand({
      action: 'doctor',
      run: () => doctorCommand(),
      target: { kind: 'system', name: 'doctor' },
    })
  })

const knownCommands = new Set([
  ...program.commands.map(command => command.name()),
  ...program.commands.flatMap(command => command.aliases()),
  'help',
  '--help',
  '--version',
  '-v',
])

const shortcutInvocation = resolveShortcutInvocation(process.argv.slice(2), knownCommands, {
  agentFriendly: process.stdin.isTTY === false || process.stdout.isTTY === false,
})

if (shortcutInvocation?.error) {
  console.log(pc.red(shortcutInvocation.error))
  process.exit(2)
}

if (shortcutInvocation) {
  const agent = getAgentByNameOrAlias(shortcutInvocation.agentName)
  if (agent) {
    try {
      setCliContext(
        resolveCliContext({
          color: shortcutInvocation.color,
          dryRun: shortcutInvocation.dryRun,
          idempotencyKey: shortcutInvocation.idempotencyKey,
          logLevel: shortcutInvocation.logLevel,
          noCache: shortcutInvocation.noCache,
          nonInteractive: shortcutInvocation.nonInteractive,
          quiet: shortcutInvocation.quiet,
          refresh: shortcutInvocation.refresh,
          runId: shortcutInvocation.runId,
          timeout: shortcutInvocation.timeout,
          yes: shortcutInvocation.yes,
        }),
      )
    } catch (error) {
      console.log(pc.red(error instanceof Error ? error.message : String(error)))
      process.exit(2)
    }
    try {
      const code = await runCommand(shortcutInvocation.agentName, shortcutInvocation.agentArgs, {
        assumeYes: shortcutInvocation.yes,
        dryRun: shortcutInvocation.dryRun,
        nonInteractive: shortcutInvocation.nonInteractive,
      })
      process.exit(code)
    } finally {
      resetCliContext()
    }
  }
}

program.parse()

function extractExecPassthroughArgs(command: { args: string[]; processedArgs: string[] }): string[] {
  const rawArgs = command.processedArgs.at(-1)
  if (Array.isArray(rawArgs)) return rawArgs

  return command.args.slice(1)
}

async function executeCliCommand<T>(options: {
  action: string
  idempotencyPolicy?: CommandIdempotencyPolicy<T> | CommandIdempotencyPolicyFactory<T>
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}): Promise<number> {
  const result = await executeCommandWithRuntime(options)
  return getExitCodeForResult(result)
}
