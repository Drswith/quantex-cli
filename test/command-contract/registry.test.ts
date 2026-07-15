import type { CommandContract } from '../../src/command-contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCommandContracts,
  getGlobalOptionDefinitions,
  toV1CommandDescriptor,
  validateCommandContractRegistry,
} from '../../src/command-contract'
import { commandsCommand } from '../../src/commands/commands'
import { getSchemaCatalog } from '../../src/commands/schema'

const stableCommandNames = [
  'capabilities',
  'commands',
  'config',
  'doctor',
  'exec',
  'ensure',
  'info',
  'inspect',
  'install',
  'list',
  'resolve',
  'schema',
  'update',
  'uninstall',
  'upgrade',
]

describe('command contract registry', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('projects all stable commands exactly once into discovery', async () => {
    const contracts = getCommandContracts()
    const discovered = (await commandsCommand()).data?.commands ?? []
    const commandNames = contracts.map(contract => contract.name)

    expect(commandNames).toEqual(stableCommandNames)
    expect(new Set(commandNames).size).toBe(contracts.length)
    expect(discovered).toEqual(contracts.map(toV1CommandDescriptor))
  })

  it('keeps schema names in exact parity with registered schema references', () => {
    const contracts = getCommandContracts()
    const schemaNames = getSchemaCatalog().map(schema => schema.name)

    expect([...schemaNames].sort()).toEqual(contracts.map(contract => contract.schemaName).sort())
    expect(getSchemaCatalog()).toEqual(contracts.map(contract => contract.schema))
    expect(() => validate(contracts)).not.toThrow()
  })

  it('declares the network effect used by capabilities self inspection', () => {
    const capabilities = getCommandContracts().find(contract => contract.name === 'capabilities')

    expect(capabilities?.effects).toContain('network')
  })

  it('defines one resolvable handler, presenter, argument list, and option list for every command', () => {
    const contracts = getCommandContracts()

    for (const contract of contracts) {
      expect(contract.handlerId).toBe(contract.name)
      expect(contract.presenterId).toBe(contract.name)
      expect(contract.arguments).toBeDefined()
      expect(contract.options).toBeDefined()
      expect(contract.globalOptions).toBeDefined()
    }
  })

  it('defines global option metadata once with unique property names and flags', () => {
    const options = getGlobalOptionDefinitions()

    expect(new Set(options.map(option => option.id)).size).toBe(options.length)
    expect(new Set(options.map(option => option.flags)).size).toBe(options.length)
    expect(options.map(option => option.flags)).toEqual([
      '--json',
      '--output <mode>',
      '--non-interactive',
      '--yes',
      '--quiet',
      '--color <mode>',
      '--log-level <level>',
      '--dry-run',
      '--refresh',
      '--no-cache',
      '--run-id <id>',
      '--idempotency-key <key>',
      '--timeout <duration>',
    ])
  })

  it('rejects duplicate command names', () => {
    const contracts = getCommandContracts()
    const duplicateName = contracts.map((contract, index) =>
      index === 1 ? { ...contract, name: contracts[0].name } : contract,
    )

    expect(() => validate(duplicateName)).toThrow('Duplicate command name: capabilities')
  })

  it('rejects duplicate aliases', () => {
    const contracts = getCommandContracts()
    const duplicateAlias = contracts.map((contract, index) =>
      index < 2 ? { ...contract, aliases: ['shared'] } : contract,
    )

    expect(() => validate(duplicateAlias)).toThrow('Duplicate command alias: shared')
  })

  it('rejects aliases that collide with command names', () => {
    const contracts = getCommandContracts()
    const collidingAlias = contracts.map((contract, index) =>
      index === 0 ? { ...contract, aliases: ['commands'] } : contract,
    )

    expect(() => validate(collidingAlias)).toThrow('Command alias collides with command name: commands')
  })

  it('rejects duplicate effects within a command', () => {
    const contracts = getCommandContracts()
    const contractIndex = contracts.findIndex(contract => contract.effects.length > 0)
    const effect = contracts[contractIndex].effects[0]
    const duplicateEffect = contracts.map((contract, index) =>
      index === contractIndex ? { ...contract, effects: [effect, effect] } : contract,
    )

    expect(() => validate(duplicateEffect)).toThrow(`Duplicate command effect: ${effect}`)
  })

  it('rejects duplicate argument names', () => {
    const contracts = getCommandContracts()
    const duplicateArgument = contracts.map((contract, index) =>
      index === 0
        ? {
            ...contract,
            arguments: [
              { description: 'first', name: 'target', syntax: '<target>' as const },
              { description: 'second', name: 'target', syntax: '[target]' as const },
            ],
          }
        : contract,
    )

    expect(() => validate(duplicateArgument)).toThrow('Duplicate command argument: capabilities target')
  })

  it('rejects command options that duplicate inherited global options', () => {
    const contracts = getCommandContracts()
    const duplicateOption = contracts.map((contract, index) =>
      index === 0
        ? {
            ...contract,
            options: [
              ...contract.options,
              { description: 'duplicate', flags: '--timeout <duration>', id: 'timeout', value: 'string' as const },
            ],
          }
        : contract,
    )

    expect(() => validate(duplicateOption)).toThrow('Command option duplicates global option: capabilities --timeout')
  })

  it('rejects mutation-sensitive options without a mutation effect', () => {
    const contracts = getCommandContracts()
    const effectMismatch = contracts.map((contract, index) =>
      index === 0 ? { ...contract, globalOptions: [...contract.globalOptions, 'dryRun' as const] } : contract,
    )

    expect(() => validate(effectMismatch)).toThrow(
      'Command effect mismatch: capabilities exposes --dry-run without mutation',
    )
  })

  it('rejects unresolved handlers and presenters', () => {
    const contracts = getCommandContracts()
    const unresolvedHandler = contracts.map((contract, index) =>
      index === 0 ? { ...contract, handlerId: 'missing-handler' as CommandContract['handlerId'] } : contract,
    )
    const unresolvedPresenter = contracts.map((contract, index) =>
      index === 0 ? { ...contract, presenterId: 'missing-presenter' as CommandContract['presenterId'] } : contract,
    )

    expect(() => validate(unresolvedHandler)).toThrow('Unresolved command handler: missing-handler')
    expect(() => validate(unresolvedPresenter)).toThrow('Unresolved command presenter: missing-presenter')
  })

  it('rejects command references without a matching schema', () => {
    const contracts = getCommandContracts()
    const schemaNames = getSchemaCatalog()
      .map(schema => schema.name)
      .filter(name => name !== contracts[0].schemaName)

    expect(() => validateCommandContractRegistry(contracts, schemaNames)).toThrow(
      'Missing command schema: capabilities',
    )
  })

  it('rejects discovery flags that drift from structured option metadata', () => {
    const contracts = getCommandContracts()
    const drifted = contracts.map((contract, index) =>
      index === 0 ? { ...contract, flags: [...contract.flags, '--undeclared'] } : contract,
    )

    expect(() => validate(drifted)).toThrow('Command discovery option mismatch: capabilities')
  })

  it('rejects an attached schema whose identity differs from the command schema reference', () => {
    const contracts = getCommandContracts()
    const mismatched = contracts.map((contract, index) =>
      index === 0 ? { ...contract, schema: { ...contract.schema, name: 'commands' } } : contract,
    )

    expect(() => validate(mismatched)).toThrow('Command schema mismatch: capabilities commands')
  })
})

function validate(contracts: readonly CommandContract[]): void {
  validateCommandContractRegistry(
    contracts,
    getSchemaCatalog().map(schema => schema.name),
  )
}
