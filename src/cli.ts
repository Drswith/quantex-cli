#!/usr/bin/env bun

import process from 'node:process'
import { program } from 'commander'
import { getAgentByNameOrAlias } from './agents'
import { runCommand } from './commands/run'

const packageJson = await Bun.file(new URL('../package.json', import.meta.url)).json() as { version?: string }

program
  .name('quantex')
  .description('统一的 AI Agent CLI 管理工具')
  .version(packageJson.version ?? '0.0.0')

program
  .command('install <agent>')
  .alias('i')
  .description('安装指定 agent')
  .action(async (agent: string) => {
    const { installCommand } = await import('./commands/install')
    await installCommand(agent)
  })

program
  .command('update')
  .argument('[agent]', 'Agent name or alias')
  .option('--all', '更新所有已安装的 agent')
  .alias('u')
  .description('更新指定 agent')
  .action(async (agent: string | undefined, options: { all?: boolean }) => {
    const { updateCommand } = await import('./commands/update')
    await updateCommand(agent, options.all ?? false)
  })

program
  .command('uninstall <agent>')
  .alias('rm')
  .description('卸载指定 agent')
  .action(async (agent: string) => {
    const { uninstallCommand } = await import('./commands/uninstall')
    await uninstallCommand(agent)
  })

program
  .command('list')
  .alias('ls')
  .description('列出所有支持的 agent')
  .action(async () => {
    const { listCommand } = await import('./commands/list')
    await listCommand()
  })

program
  .command('info <agent>')
  .description('查看 agent 详细信息')
  .action(async (agent: string) => {
    const { infoCommand } = await import('./commands/info')
    await infoCommand(agent)
  })

program
  .command('config')
  .argument('[action]', 'Action: get, set, reset')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value')
  .description('配置管理')
  .action(async (action?: string, key?: string, value?: string) => {
    const { configCommand } = await import('./commands/config')
    await configCommand(action, key, value)
  })

program
  .command('upgrade')
  .description('升级 Quantex CLI')
  .action(async () => {
    const { upgradeCommand } = await import('./commands/upgrade')
    await upgradeCommand()
  })

program
  .command('doctor')
  .description('检查环境')
  .action(async () => {
    const { doctorCommand } = await import('./commands/doctor')
    await doctorCommand()
  })

const firstArg = process.argv[2]
const knownCommands = new Set([
  ...program.commands.map(command => command.name()),
  ...program.commands.flatMap(command => command.aliases()),
  'help',
  '--help',
  '--version',
  '-v',
])

if (firstArg && !firstArg.startsWith('-') && !knownCommands.has(firstArg)) {
  const agent = getAgentByNameOrAlias(firstArg)
  if (agent) {
    const args = process.argv.slice(3)
    const code = await runCommand(firstArg, args)
    process.exit(code)
  }
}

program.parse()
