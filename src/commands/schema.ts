import type { SchemaDocument } from '../command-contract/schemas'
import type { CommandResult } from '../output/types'
import { getCommandContracts } from '../command-contract'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../output'
import { getHumanTerminalWidth, renderHumanTable, renderHumanWrapped } from '../output/human'
import { pc } from '../utils/color'

export type { JsonSchema, SchemaDocument } from '../command-contract/schemas'

interface SchemaCommandData {
  commands: readonly SchemaDocument[]
}

export async function schemaCommand(commandName?: string): Promise<CommandResult<SchemaCommandData>> {
  const catalog = getSchemaCatalog()
  const commands = commandName ? catalog.filter(schema => schema.name === commandName) : catalog

  if (commandName && commands.length === 0) {
    return emitCommandResult(
      createErrorResult<SchemaCommandData>({
        action: 'schema',
        error: {
          code: 'INVALID_ARGUMENT',
          details: {
            command: commandName,
          },
          message: `Unknown schema target: ${commandName}`,
        },
        target: {
          kind: 'system',
          name: 'schema',
        },
      }),
      renderSchemaHuman,
    )
  }

  return emitCommandResult(
    createSuccessResult<SchemaCommandData>({
      action: 'schema',
      data: {
        commands,
      },
      target: {
        kind: 'system',
        name: 'schema',
      },
    }),
    renderSchemaHuman,
  )
}

function renderSchemaHuman(result: { data?: SchemaCommandData; error: { message: string } | null }): void {
  if (result.error) {
    console.log(pc.red(result.error.message))
    return
  }

  if (!result.data) return

  const width = getHumanTerminalWidth()
  console.log(pc.bold('\nQuantex Schemas\n'))
  for (const line of renderHumanTable(
    result.data.commands,
    [
      { header: 'Command', maxWidth: 24, minWidth: 8, value: schema => pc.cyan(schema.name) },
      { header: 'Description', minWidth: 16, value: schema => schema.description, wrap: true },
    ],
    { headerStyle: pc.bold, width },
  )) {
    console.log(line)
  }
  console.log()
  for (const line of renderHumanWrapped(pc.dim('Document: qtx schema <command> --json'), { indent: '  ', width })) {
    console.log(line)
  }
  console.log()
}

export function getSchemaCatalog(): readonly SchemaDocument[] {
  return getCommandContracts().map(contract => contract.schema)
}
