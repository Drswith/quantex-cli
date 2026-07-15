import { Command } from 'commander'
import process from 'node:process'
import { resetCliContext, resolveCliContext, setCliContext } from '../cli-context'
import { getSelfVersion } from '../self'
import { pc } from '../utils/color'
import { getCommandActionHandler } from './handlers'
import {
  getCommandContracts,
  getGlobalOptionDefinitions,
  normalizeCommanderGlobalOptions,
  validateCommandContractRegistry,
} from './registry'

export function createCliProgram(): Command {
  const contracts = getCommandContracts()
  validateCommandContractRegistry(
    contracts,
    contracts.map(contract => contract.schema.name),
  )
  const program = new Command()
  program.name('quantex').description('统一的 AI Agent CLI 管理工具')

  for (const option of getGlobalOptionDefinitions()) {
    program.option(option.flags, option.description, option.defaultValue)
  }
  program.version(getSelfVersion())

  program.hook('preAction', (_command, actionCommand) => {
    try {
      setCliContext(resolveCliContext(normalizeCommanderGlobalOptions(actionCommand.optsWithGlobals())))
    } catch (error) {
      process.stdout.write(`${pc.red(error instanceof Error ? error.message : String(error))}\n`)
      process.exit(2)
    }
  })

  program.hook('postAction', () => {
    resetCliContext()
  })

  for (const contract of contracts) {
    const command = program.command(contract.name).description(contract.description)
    for (const alias of contract.aliases) command.alias(alias)
    for (const argument of contract.arguments) command.argument(argument.syntax, argument.description)
    if (contract.allowUnknownOptions) command.allowUnknownOption()
    for (const option of contract.options) {
      command.option(option.flags, option.description, option.defaultValue)
    }
    command.action(getCommandActionHandler(contract.handlerId))
  }

  return program
}
