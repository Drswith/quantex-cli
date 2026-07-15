import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCommandContracts, getGlobalOptionDefinitions } from '../src/command-contract'
import { createCliProgram } from '../src/command-contract/commander'

describe('registry-generated Commander surface', () => {
  it('registers every stable command exactly once with its aliases, arguments, and local options', () => {
    const program = createCliProgram()
    const contracts = getCommandContracts()

    expect(program.commands.map(command => command.name())).toEqual(contracts.map(contract => contract.name))

    for (const contract of contracts) {
      const command = program.commands.find(candidate => candidate.name() === contract.name)
      expect(command).toBeDefined()
      expect(command?.aliases()).toEqual(contract.aliases)
      expect(command?.description()).toBe(contract.description)
      expect(command?.registeredArguments.map(argument => argument.name())).toEqual(
        contract.arguments.map(argument => argument.name),
      )
      expect(command?.registeredArguments.map(argument => argument.required)).toEqual(
        contract.arguments.map(argument => argument.syntax.startsWith('<')),
      )
      expect(command?.registeredArguments.map(argument => argument.variadic)).toEqual(
        contract.arguments.map(argument => argument.syntax.includes('...')),
      )
      expect(command?.options.map(option => option.flags)).toEqual(contract.options.map(option => option.flags))
    }
  })

  it('registers root global options once from the shared option definitions', () => {
    const program = createCliProgram()

    expect(program.options.filter(option => option.long !== '--version').map(option => option.flags)).toEqual(
      getGlobalOptionDefinitions().map(option => option.flags),
    )
  })

  it('preserves the accepted command and alias names', () => {
    const program = createCliProgram()
    const accepted = program.commands.flatMap(command => [command.name(), ...command.aliases()])

    expect(accepted).toEqual([
      'capabilities',
      'commands',
      'config',
      'doctor',
      'exec',
      'ensure',
      'info',
      'inspect',
      'install',
      'i',
      'list',
      'ls',
      'resolve',
      'schema',
      'update',
      'u',
      'uninstall',
      'rm',
      'upgrade',
    ])
  })

  it('normalizes Commander negated options before resolving the CLI context', () => {
    const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
    const result = spawnSync('bun', [cliPath, '--refresh', '--no-cache', '--output', 'json', 'commands'], {
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stdout).toContain('Cannot combine --refresh with --no-cache.')
  })
})
