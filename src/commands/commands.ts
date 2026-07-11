import type { V1CommandDescriptor } from '../command-contract'
import type { CommandResult } from '../output/types'
import { getCommandContracts, toV1CommandDescriptor } from '../command-contract'
import { createSuccessResult, emitCommandResult } from '../output'
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

  console.log(pc.bold('\nQuantex Commands\n'))
  for (const command of result.data.commands) {
    const flags = command.flags.length > 0 ? pc.dim(` [${command.flags.join(', ')}]`) : ''
    console.log(`  ${pc.cyan(command.name)}${flags}`)
    console.log(`    ${command.summary}`)
    console.log(`    ${pc.dim(command.outputSchemaRef)}`)
  }
  console.log()
}
