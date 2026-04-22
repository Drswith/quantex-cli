import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createSuccessResult, emitCommandResult } from '../output'

interface CommandDescriptor {
  flags: string[]
  name: string
  outputSchemaRef: string
  stability: 'stable'
  summary: string
}

interface CommandsCommandData {
  commands: CommandDescriptor[]
}

const commandCatalog: CommandDescriptor[] = [
  { flags: ['--json', '--output', '--non-interactive', '--refresh', '--no-cache', '--timeout'], name: 'capabilities', outputSchemaRef: '#/commands/capabilities', stability: 'stable', summary: 'Return environment and surface capabilities' },
  { flags: ['--json', '--output', '--timeout'], name: 'commands', outputSchemaRef: '#/commands/commands', stability: 'stable', summary: 'Return the stable command catalog' },
  { flags: ['get', 'set', 'reset', '--json', '--output', '--timeout'], name: 'config', outputSchemaRef: '#/commands/config', stability: 'stable', summary: 'Read and modify Quantex configuration' },
  { flags: ['--json', '--output', '--refresh', '--no-cache', '--timeout'], name: 'doctor', outputSchemaRef: '#/commands/doctor', stability: 'stable', summary: 'Diagnose the current environment and installed tools' },
  { flags: ['--install', '--non-interactive', '--output'], name: 'exec', outputSchemaRef: '#/commands/exec', stability: 'stable', summary: 'Run an agent with explicit install policy' },
  { flags: ['--json', '--output', '--timeout', '--idempotency-key'], name: 'ensure', outputSchemaRef: '#/commands/ensure', stability: 'stable', summary: 'Ensure an agent is installed' },
  { flags: ['--json', '--output', '--refresh', '--no-cache', '--timeout'], name: 'info', outputSchemaRef: '#/commands/info', stability: 'stable', summary: 'Show human-friendly agent details' },
  { flags: ['--json', '--output', '--refresh', '--no-cache', '--timeout'], name: 'inspect', outputSchemaRef: '#/commands/inspect', stability: 'stable', summary: 'Return structured agent state' },
  { flags: ['--json', '--output', '--timeout', '--idempotency-key'], name: 'install', outputSchemaRef: '#/commands/install', stability: 'stable', summary: 'Install an agent' },
  { flags: ['--json', '--output', '--refresh', '--no-cache', '--timeout'], name: 'list', outputSchemaRef: '#/commands/list', stability: 'stable', summary: 'List supported agents' },
  { flags: ['--json', '--output', '--refresh', '--no-cache', '--timeout'], name: 'resolve', outputSchemaRef: '#/commands/resolve', stability: 'stable', summary: 'Resolve an agent executable entrypoint' },
  { flags: ['--json', '--output', '--timeout'], name: 'schema', outputSchemaRef: '#/commands/schema', stability: 'stable', summary: 'Return structured output schemas' },
  { flags: ['--all', '--json', '--output', '--refresh', '--no-cache', '--timeout', '--idempotency-key'], name: 'update', outputSchemaRef: '#/commands/update', stability: 'stable', summary: 'Update one or all agents' },
  { flags: ['--json', '--output', '--timeout', '--idempotency-key'], name: 'uninstall', outputSchemaRef: '#/commands/uninstall', stability: 'stable', summary: 'Uninstall an agent' },
  { flags: ['--check', '--channel', '--json', '--output', '--refresh', '--no-cache', '--timeout', '--idempotency-key'], name: 'upgrade', outputSchemaRef: '#/commands/upgrade', stability: 'stable', summary: 'Upgrade Quantex CLI itself' },
]

export async function commandsCommand(): Promise<CommandResult<CommandsCommandData>> {
  return emitCommandResult(createSuccessResult<CommandsCommandData>({
    action: 'commands',
    data: {
      commands: commandCatalog,
    },
    target: {
      kind: 'system',
      name: 'commands',
    },
  }), renderCommandsHuman)
}

function renderCommandsHuman(result: { data?: CommandsCommandData }): void {
  if (!result.data)
    return

  console.log(pc.bold('\nQuantex Commands\n'))
  for (const command of result.data.commands) {
    const flags = command.flags.length > 0 ? pc.dim(` [${command.flags.join(', ')}]`) : ''
    console.log(`  ${pc.cyan(command.name)}${flags}`)
    console.log(`    ${command.summary}`)
    console.log(`    ${pc.dim(command.outputSchemaRef)}`)
  }
  console.log()
}
