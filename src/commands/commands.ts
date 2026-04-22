import type { CommandResult } from '../output/types'
import pc from 'picocolors'
import { createSuccessResult, emitCommandResult } from '../output'

interface CommandDescriptor {
  flags: string[]
  name: string
  stability: 'stable'
  summary: string
}

interface CommandsCommandData {
  commands: CommandDescriptor[]
}

const commandCatalog: CommandDescriptor[] = [
  { flags: ['--json', '--output', '--non-interactive'], name: 'capabilities', stability: 'stable', summary: 'Return environment and surface capabilities' },
  { flags: ['--json'], name: 'commands', stability: 'stable', summary: 'Return the stable command catalog' },
  { flags: ['get', 'set', 'reset', '--json'], name: 'config', stability: 'stable', summary: 'Read and modify Quantex configuration' },
  { flags: ['--json'], name: 'doctor', stability: 'stable', summary: 'Diagnose the current environment and installed tools' },
  { flags: ['--install', '--non-interactive'], name: 'exec', stability: 'stable', summary: 'Run an agent with explicit install policy' },
  { flags: ['--json'], name: 'ensure', stability: 'stable', summary: 'Ensure an agent is installed' },
  { flags: ['--json'], name: 'info', stability: 'stable', summary: 'Show human-friendly agent details' },
  { flags: ['--json'], name: 'inspect', stability: 'stable', summary: 'Return structured agent state' },
  { flags: ['--json'], name: 'install', stability: 'stable', summary: 'Install an agent' },
  { flags: ['--json'], name: 'list', stability: 'stable', summary: 'List supported agents' },
  { flags: ['--all', '--json'], name: 'update', stability: 'stable', summary: 'Update one or all agents' },
  { flags: ['--json'], name: 'uninstall', stability: 'stable', summary: 'Uninstall an agent' },
  { flags: ['--check', '--channel', '--json'], name: 'upgrade', stability: 'stable', summary: 'Upgrade Quantex CLI itself' },
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
  }
  console.log()
}
