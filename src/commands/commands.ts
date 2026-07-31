import type { V1CommandDescriptor } from '../command-contract'
import type { CommandResult } from '../output/types'
import { getCommandContracts, toV1CommandDescriptor } from '../command-contract'
import { createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanTable, renderHumanWrapped } from '../output/human'
import { pc } from '../utils/color'

interface CommandsCommandData {
  commands: V1CommandDescriptor[]
}

export async function commandsCommand(): Promise<CommandResult<CommandsCommandData>> {
  return emitCommandResult(
    createSuccessResult<CommandsCommandData>({
      action: 'commands',
      data: {
        commands: getCommandContracts().map(toV1CommandDescriptor),
      },
      target: {
        kind: 'system',
        name: 'commands',
      },
    }),
    renderCommandsHuman,
  )
}

function renderCommandsHuman(result: { data?: CommandsCommandData }): void {
  if (!result.data) return

  const width = getHumanTerminalWidth()
  console.log(pc.bold('\nQuantex Commands\n'))
  for (const line of renderHumanTable(
    result.data.commands,
    [
      { header: 'Command', maxWidth: 24, minWidth: 8, value: command => pc.cyan(command.name) },
      { header: 'Summary', minWidth: 16, value: command => command.summary, wrap: true },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }
  console.log()
  for (const line of renderHumanWrapped(pc.dim('Contracts: qtx commands --json · Schemas: qtx schema <command>'), {
    indent: '  ',
    width,
  })) {
    console.log(line)
  }
  console.log()
}
