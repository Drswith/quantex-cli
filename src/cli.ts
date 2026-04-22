#!/usr/bin/env bun

import process from 'node:process'
import { program } from 'commander'
import pc from 'picocolors'
import { getAgentByNameOrAlias } from './agents'
import { resetCliContext, resolveCliContext, setCliContext } from './cli-context'
import { runCommand } from './commands/run'
import { getExitCodeForResult } from './errors'
import { getSelfVersion } from './self'

program
  .name('quantex')
  .description('统一的 AI Agent CLI 管理工具')
  .option('--json', 'Output structured JSON')
  .option('--output <mode>', 'Output mode: human or json')
  .option('--non-interactive', 'Disable interactive prompts and confirmations')
  .option('--run-id <id>', 'Attach a run id to structured output and logs')
  .version(getSelfVersion())

program.hook('preAction', (_command, actionCommand) => {
  setCliContext(resolveCliContext(actionCommand.optsWithGlobals()))
})

program.hook('postAction', () => {
  resetCliContext()
})

program
  .command('capabilities')
  .description('查看当前环境与 surface 能力')
  .action(async () => {
    const { capabilitiesCommand } = await import('./commands/capabilities')
    process.exitCode = getExitCodeForResult(await capabilitiesCommand())
  })

program
  .command('inspect <agent>')
  .description('查看 agent 结构化状态')
  .action(async (agent: string) => {
    const { inspectCommand } = await import('./commands/inspect')
    process.exitCode = getExitCodeForResult(await inspectCommand(agent))
  })

program
  .command('install <agent>')
  .alias('i')
  .description('安装指定 agent')
  .action(async (agent: string) => {
    const { installCommand } = await import('./commands/install')
    process.exitCode = getExitCodeForResult(await installCommand(agent))
  })

program
  .command('ensure <agent>')
  .description('确保指定 agent 已安装')
  .action(async (agent: string) => {
    const { ensureCommand } = await import('./commands/ensure')
    process.exitCode = getExitCodeForResult(await ensureCommand(agent))
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
    process.exitCode = getExitCodeForResult(await updateCommand(agent, options.all ?? false))
  })

program
  .command('uninstall <agent>')
  .alias('rm')
  .description('卸载指定 agent')
  .action(async (agent: string) => {
    const { uninstallCommand } = await import('./commands/uninstall')
    process.exitCode = getExitCodeForResult(await uninstallCommand(agent))
  })

program
  .command('list')
  .alias('ls')
  .description('列出所有支持的 agent')
  .action(async () => {
    const { listCommand } = await import('./commands/list')
    process.exitCode = getExitCodeForResult(await listCommand())
  })

program
  .command('info <agent>')
  .description('查看 agent 详细信息')
  .action(async (agent: string) => {
    const { infoCommand } = await import('./commands/info')
    process.exitCode = getExitCodeForResult(await infoCommand(agent))
  })

program
  .command('config')
  .argument('[action]', 'Action: get, set, reset')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value')
  .description('配置管理')
  .action(async (action?: string, key?: string, value?: string) => {
    const { configCommand } = await import('./commands/config')
    process.exitCode = getExitCodeForResult(await configCommand(action, key, value))
  })

program
  .command('upgrade')
  .description('升级 Quantex CLI')
  .option('--channel <channel>', 'Update channel: stable or beta')
  .option('--check', 'Only check whether an update is available')
  .action(async (options: { channel?: string, check?: boolean }) => {
    const { upgradeCommand } = await import('./commands/upgrade')
    const result = await upgradeCommand({
      channel: options.channel === 'beta' ? 'beta' : undefined,
      check: options.check ?? false,
    })
    process.exitCode = getExitCodeForResult(result)
  })

program
  .command('doctor')
  .description('检查环境')
  .action(async () => {
    const { doctorCommand } = await import('./commands/doctor')
    process.exitCode = getExitCodeForResult(await doctorCommand())
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
    setCliContext(resolveCliContext({
      nonInteractive: shortcutInvocation.nonInteractive,
      runId: shortcutInvocation.runId,
    }))
    try {
      const code = await runCommand(shortcutInvocation.agentName, shortcutInvocation.agentArgs, {
        nonInteractive: shortcutInvocation.nonInteractive,
      })
      process.exit(code)
    }
    finally {
      resetCliContext()
    }
  }
}

program.parse()

interface ShortcutInvocation {
  agentArgs: string[]
  agentName: string
  error?: string
  nonInteractive?: boolean
  runId?: string
}

function extractExecPassthroughArgs(command: { args: string[], processedArgs: string[] }): string[] {
  const rawArgs = command.processedArgs.at(-1)
  if (Array.isArray(rawArgs))
    return rawArgs

  return command.args.slice(1)
}

function resolveShortcutInvocation(argv: string[], knownCommandNames: Set<string>): ShortcutInvocation | undefined {
  let index = 0
  let jsonOutputRequested = false
  let nonInteractive = false
  let outputMode: string | undefined
  let runId: string | undefined

  while (index < argv.length) {
    const arg = argv[index]

    if (arg === '--json') {
      jsonOutputRequested = true
      index += 1
      continue
    }

    if (arg === '--output') {
      const value = argv[index + 1]
      if (!value)
        return { agentArgs: [], agentName: '', error: '--output requires a value' }
      outputMode = value
      index += 2
      continue
    }

    if (arg === '--non-interactive') {
      nonInteractive = true
      index += 1
      continue
    }

    if (arg === '--run-id') {
      const value = argv[index + 1]
      if (!value)
        return { agentArgs: [], agentName: '', error: '--run-id requires a value' }
      runId = value
      index += 2
      continue
    }

    if (arg.startsWith('-'))
      return undefined

    if (knownCommandNames.has(arg))
      return undefined

    if (jsonOutputRequested || outputMode === 'json')
      return { agentArgs: [], agentName: '', error: 'Structured output is not supported for shortcut agent execution yet. Use a management command instead.' }

    return {
      agentArgs: argv.slice(index + 1),
      agentName: arg,
      nonInteractive,
      runId,
    }
  }

  return undefined
}
