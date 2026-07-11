export type StableCommandName =
  | 'capabilities'
  | 'commands'
  | 'config'
  | 'doctor'
  | 'exec'
  | 'ensure'
  | 'info'
  | 'inspect'
  | 'install'
  | 'list'
  | 'resolve'
  | 'schema'
  | 'update'
  | 'uninstall'
  | 'upgrade'

export type CommandEffect = 'filesystem' | 'interaction' | 'mutation' | 'network' | 'process'

export interface CommandContract {
  aliases: readonly string[]
  effects: readonly CommandEffect[]
  flags: readonly string[]
  name: StableCommandName
  schemaName: StableCommandName
  stability: 'stable'
  summary: string
}

export interface V1CommandDescriptor {
  flags: string[]
  name: string
  outputSchemaRef: string
  stability: 'stable'
  summary: string
}

const commandContracts: readonly CommandContract[] = [
  {
    aliases: [],
    effects: ['filesystem', 'network', 'process'],
    flags: [
      '--json',
      '--output',
      '--non-interactive',
      '--quiet',
      '--color',
      '--log-level',
      '--refresh',
      '--no-cache',
      '--timeout',
    ],
    name: 'capabilities',
    schemaName: 'capabilities',
    stability: 'stable',
    summary: 'Return environment and surface capabilities',
  },
  {
    aliases: [],
    effects: [],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--timeout'],
    name: 'commands',
    schemaName: 'commands',
    stability: 'stable',
    summary: 'Return the stable command catalog',
  },
  {
    aliases: [],
    effects: ['filesystem', 'mutation'],
    flags: ['get', 'set', 'reset', '--json', '--output', '--quiet', '--color', '--log-level', '--timeout'],
    name: 'config',
    schemaName: 'config',
    stability: 'stable',
    summary: 'Read and modify Quantex configuration',
  },
  {
    aliases: [],
    effects: ['filesystem', 'network', 'process'],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--refresh', '--no-cache', '--timeout'],
    name: 'doctor',
    schemaName: 'doctor',
    stability: 'stable',
    summary: 'Diagnose the current environment and installed tools',
  },
  {
    aliases: [],
    effects: ['filesystem', 'interaction', 'mutation', 'network', 'process'],
    flags: ['--install', '--non-interactive', '--yes', '--quiet', '--color', '--log-level', '--dry-run', '--output'],
    name: 'exec',
    schemaName: 'exec',
    stability: 'stable',
    summary: 'Run an agent with explicit install policy',
  },
  {
    aliases: [],
    effects: ['filesystem', 'interaction', 'mutation', 'network', 'process'],
    flags: [
      '--json',
      '--output',
      '--yes',
      '--quiet',
      '--color',
      '--log-level',
      '--dry-run',
      '--timeout',
      '--idempotency-key',
    ],
    name: 'ensure',
    schemaName: 'ensure',
    stability: 'stable',
    summary: 'Ensure an agent is installed',
  },
  {
    aliases: [],
    effects: ['filesystem', 'network', 'process'],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--refresh', '--no-cache', '--timeout'],
    name: 'info',
    schemaName: 'info',
    stability: 'stable',
    summary: 'Show human-friendly agent details',
  },
  {
    aliases: [],
    effects: ['filesystem', 'network', 'process'],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--refresh', '--no-cache', '--timeout'],
    name: 'inspect',
    schemaName: 'inspect',
    stability: 'stable',
    summary: 'Return structured agent state',
  },
  {
    aliases: ['i'],
    effects: ['filesystem', 'interaction', 'mutation', 'network', 'process'],
    flags: [
      '--json',
      '--output',
      '--yes',
      '--quiet',
      '--color',
      '--log-level',
      '--dry-run',
      '--timeout',
      '--idempotency-key',
    ],
    name: 'install',
    schemaName: 'install',
    stability: 'stable',
    summary: 'Install one or more agents',
  },
  {
    aliases: ['ls'],
    effects: ['filesystem', 'network', 'process'],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--refresh', '--no-cache', '--timeout'],
    name: 'list',
    schemaName: 'list',
    stability: 'stable',
    summary: 'List supported agents',
  },
  {
    aliases: [],
    effects: ['filesystem', 'network', 'process'],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--refresh', '--no-cache', '--timeout'],
    name: 'resolve',
    schemaName: 'resolve',
    stability: 'stable',
    summary: 'Resolve an agent executable entrypoint',
  },
  {
    aliases: [],
    effects: [],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--timeout'],
    name: 'schema',
    schemaName: 'schema',
    stability: 'stable',
    summary: 'Return structured output schemas',
  },
  {
    aliases: ['u'],
    effects: ['filesystem', 'mutation', 'network', 'process'],
    flags: [
      '--all',
      '--json',
      '--output',
      '--quiet',
      '--color',
      '--log-level',
      '--dry-run',
      '--refresh',
      '--no-cache',
      '--timeout',
      '--idempotency-key',
    ],
    name: 'update',
    schemaName: 'update',
    stability: 'stable',
    summary: 'Update one or all agents',
  },
  {
    aliases: ['rm'],
    effects: ['filesystem', 'mutation', 'process'],
    flags: ['--json', '--output', '--quiet', '--color', '--log-level', '--dry-run', '--timeout', '--idempotency-key'],
    name: 'uninstall',
    schemaName: 'uninstall',
    stability: 'stable',
    summary: 'Uninstall an agent',
  },
  {
    aliases: [],
    effects: ['filesystem', 'mutation', 'network', 'process'],
    flags: [
      '--check',
      '--channel',
      '--json',
      '--output',
      '--quiet',
      '--color',
      '--log-level',
      '--dry-run',
      '--refresh',
      '--no-cache',
      '--timeout',
      '--idempotency-key',
    ],
    name: 'upgrade',
    schemaName: 'upgrade',
    stability: 'stable',
    summary: 'Upgrade Quantex CLI itself',
  },
]

export function getCommandContracts(): readonly CommandContract[] {
  return commandContracts
}

export function toV1CommandDescriptor(contract: CommandContract): V1CommandDescriptor {
  return {
    flags: [...contract.flags],
    name: contract.name,
    outputSchemaRef: `#/commands/${contract.schemaName}`,
    stability: contract.stability,
    summary: contract.summary,
  }
}

export function validateCommandContractRegistry(
  contracts: readonly CommandContract[],
  schemaNames: readonly string[],
): void {
  const names = new Set<string>()
  const aliases = new Set<string>()

  for (const contract of contracts) {
    if (names.has(contract.name)) throw new Error(`Duplicate command name: ${contract.name}`)
    names.add(contract.name)
  }

  for (const contract of contracts) {
    const effects = new Set<CommandEffect>()

    for (const alias of contract.aliases) {
      if (names.has(alias)) throw new Error(`Command alias collides with command name: ${alias}`)
      if (aliases.has(alias)) throw new Error(`Duplicate command alias: ${alias}`)
      aliases.add(alias)
    }

    for (const effect of contract.effects) {
      if (effects.has(effect)) throw new Error(`Duplicate command effect: ${effect}`)
      effects.add(effect)
    }
  }

  const availableSchemas = new Set(schemaNames)
  for (const contract of contracts) {
    if (!availableSchemas.has(contract.schemaName)) throw new Error(`Missing command schema: ${contract.schemaName}`)
  }
}
