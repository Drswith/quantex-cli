import type { CommandContract } from '../../src/command-contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCommandContracts, toV1CommandDescriptor, validateCommandContractRegistry } from '../../src/command-contract'
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
  })

  it('declares the network effect used by capabilities self inspection', () => {
    const capabilities = getCommandContracts().find(contract => contract.name === 'capabilities')

    expect(capabilities?.effects).toContain('network')
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

  it('rejects command references without a matching schema', () => {
    const contracts = getCommandContracts()
    const schemaNames = getSchemaCatalog()
      .map(schema => schema.name)
      .filter(name => name !== contracts[0].schemaName)

    expect(() => validateCommandContractRegistry(contracts, schemaNames)).toThrow(
      'Missing command schema: capabilities',
    )
  })
})

function validate(contracts: readonly CommandContract[]): void {
  validateCommandContractRegistry(
    contracts,
    getSchemaCatalog().map(schema => schema.name),
  )
}
