#!/usr/bin/env bun

import type { CommandResult, CommandTarget } from './output/types'
import { program } from 'commander'
import process from 'node:process'
import { getAgentByNameOrAlias } from './agents'
import { resetCliContext, resolveCliContext, setCliContext } from './cli-context'
import { executeCommandWithRuntime } from './command-runtime'
import { runCommand } from './commands/run'
import { getExitCodeForResult } from './errors'
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
  .command('install <agent>')
  .alias('i')
  .description('安装指定 agent')
  .action(async (agent: string) => {
    const { installCommand } = await import('./commands/install')
    process.exitCode = await executeCliCommand({
      action: 'install',
      run: () => installCommand(agent),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('ensure <agent>')
  .description('确保指定 agent 已安装')
  .action(async (agent: string) => {
    const { ensureCommand } = await import('./commands/ensure')
    process.exitCode = await executeCliCommand({
      action: 'ensure',
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
    const { updateCommand } = await import('./commands/update')
    process.exitCode = await executeCliCommand({
      action: 'update',
      run: () => updateCommand(agent, options.all ?? false),
      target: { kind: 'agent', name: agent },
    })
  })

program
  .command('uninstall <agent>')
  .alias('rm')
  .description('卸载指定 agent')
  .action(async (agent: string) => {
    const { uninstallCommand } = await import('./commands/uninstall')
    process.exitCode = await executeCliCommand({
      action: 'uninstall',
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

const shortcutInvocation = resolveShortcutInvocation(process.argv.slice(2), knownCommands)

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

interface ShortcutInvocation {
  agentArgs: string[]
  agentName: string
  color?: string
  dryRun?: boolean
  error?: string
  idempotencyKey?: string
  logLevel?: string
  noCache?: boolean
  nonInteractive?: boolean
  quiet?: boolean
  refresh?: boolean
  runId?: string
  timeout?: string
  yes?: boolean
}

function extractExecPassthroughArgs(command: { args: string[]; processedArgs: string[] }): string[] {
  const rawArgs = command.processedArgs.at(-1)
  if (Array.isArray(rawArgs)) return rawArgs

  return command.args.slice(1)
}

function resolveShortcutInvocation(argv: string[], knownCommandNames: Set<string>): ShortcutInvocation | undefined {
  const autoAgentFriendly = process.stdin.isTTY === false || process.stdout.isTTY === false
  let color: string | undefined
  let dryRun = false
  let index = 0
  let idempotencyKey: string | undefined
  let jsonOutputRequested = false
  let logLevel: string | undefined
  let noCache = false
  let nonInteractive = false
  let outputMode: string | undefined
  let quiet = false
  let refresh = false
  let runId: string | undefined
  let timeout: string | undefined
  let yes = false

  while (index < argv.length) {
    const arg = argv[index]

    if (arg === '--json') {
      jsonOutputRequested = true
      index += 1
      continue
    }

    if (arg === '--output') {
      const value = argv[index + 1]
      if (!value) return { agentArgs: [], agentName: '', error: '--output requires a value' }
      outputMode = value
      index += 2
      continue
    }

    if (arg === '--non-interactive') {
      nonInteractive = true
      index += 1
      continue
    }

    if (arg === '--yes') {
      yes = true
      index += 1
      continue
    }

    if (arg === '--quiet') {
      quiet = true
      index += 1
      continue
    }

    if (arg === '--color') {
      const value = argv[index + 1]
      if (!value) return { agentArgs: [], agentName: '', error: '--color requires a value' }
      color = value
      index += 2
      continue
    }

    if (arg === '--log-level') {
      const value = argv[index + 1]
      if (!value) return { agentArgs: [], agentName: '', error: '--log-level requires a value' }
      logLevel = value
      index += 2
      continue
    }

    if (arg === '--dry-run') {
      dryRun = true
      index += 1
      continue
    }

    if (arg === '--refresh') {
      refresh = true
      index += 1
      continue
    }

    if (arg === '--no-cache') {
      noCache = true
      index += 1
      continue
    }

    if (arg === '--idempotency-key') {
      const value = argv[index + 1]
      if (!value) return { agentArgs: [], agentName: '', error: '--idempotency-key requires a value' }
      idempotencyKey = value
      index += 2
      continue
    }

    if (arg === '--run-id') {
      const value = argv[index + 1]
      if (!value) return { agentArgs: [], agentName: '', error: '--run-id requires a value' }
      runId = value
      index += 2
      continue
    }

    if (arg === '--timeout') {
      const value = argv[index + 1]
      if (!value) return { agentArgs: [], agentName: '', error: '--timeout requires a value' }
      timeout = value
      index += 2
      continue
    }

    if (arg.startsWith('-')) return undefined

    if (knownCommandNames.has(arg)) return undefined

    if (
      jsonOutputRequested ||
      outputMode === 'json' ||
      outputMode === 'ndjson' ||
      (autoAgentFriendly && outputMode !== 'human')
    )
      return {
        agentArgs: [],
        agentName: '',
        error: 'Structured output is not supported for shortcut agent execution yet. Use a management command instead.',
      }

    return {
      agentArgs: argv.slice(index + 1),
      agentName: arg,
      color,
      dryRun,
      idempotencyKey,
      logLevel,
      noCache,
      nonInteractive,
      quiet,
      refresh,
      runId,
      timeout,
      yes,
    }
  }

  return undefined
}

async function executeCliCommand<T>(options: {
  action: string
  run: () => Promise<CommandResult<T>>
  target?: CommandTarget
}): Promise<number> {
  const result = await executeCommandWithRuntime(options)
  return getExitCodeForResult(result)
}
