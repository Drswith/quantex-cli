import type { SchemaDocument } from './schemas'
import { schemaDocuments } from './schemas'

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

export type GlobalOptionId =
  | 'color'
  | 'dryRun'
  | 'idempotencyKey'
  | 'json'
  | 'logLevel'
  | 'noCache'
  | 'nonInteractive'
  | 'output'
  | 'quiet'
  | 'refresh'
  | 'runId'
  | 'timeout'
  | 'yes'

export interface CommandArgumentDefinition {
  readonly description: string
  readonly name: string
  readonly syntax: `<${string}>` | `<${string}...>` | `[${string}]` | `[${string}...]`
}

export interface CommandOptionDefinition {
  readonly defaultValue?: boolean | string
  readonly description: string
  readonly flags: string
  readonly id: string
  readonly value: 'boolean' | 'string'
}

export interface GlobalOptionDefinition extends Omit<CommandOptionDefinition, 'id'> {
  readonly commanderProperty?: string
  readonly id: GlobalOptionId
  readonly negateCommanderValue?: boolean
}

export interface CommandContract {
  readonly arguments: readonly CommandArgumentDefinition[]
  readonly aliases: readonly string[]
  readonly allowUnknownOptions?: boolean
  readonly catalogTokens: readonly string[]
  readonly description: string
  readonly effects: readonly CommandEffect[]
  readonly flags: readonly string[]
  readonly globalOptions: readonly GlobalOptionId[]
  readonly handlerId: StableCommandName
  readonly name: StableCommandName
  readonly options: readonly CommandOptionDefinition[]
  readonly presenterId: StableCommandName
  readonly schema: SchemaDocument
  readonly schemaName: StableCommandName
  readonly stability: 'stable'
  readonly summary: string
}

export interface V1CommandDescriptor {
  flags: string[]
  name: string
  outputSchemaRef: string
  stability: 'stable'
  summary: string
}

interface CommandContractDefinition {
  readonly aliases: readonly string[]
  readonly arguments?: readonly CommandArgumentDefinition[]
  readonly allowUnknownOptions?: boolean
  readonly catalogTokens?: readonly string[]
  readonly description: string
  readonly effects: readonly CommandEffect[]
  readonly globalOptions: readonly GlobalOptionId[]
  readonly name: StableCommandName
  readonly options?: readonly CommandOptionDefinition[]
  readonly summary: string
}

const globalOptionDefinitions: readonly GlobalOptionDefinition[] = [
  { description: 'Output structured JSON', flags: '--json', id: 'json', value: 'boolean' },
  { description: 'Output mode: human, json, or ndjson', flags: '--output <mode>', id: 'output', value: 'string' },
  {
    description: 'Disable interactive prompts and confirmations',
    flags: '--non-interactive',
    id: 'nonInteractive',
    value: 'boolean',
  },
  { description: 'Automatically accept safe default confirmations', flags: '--yes', id: 'yes', value: 'boolean' },
  { description: 'Suppress non-essential human logs', flags: '--quiet', id: 'quiet', value: 'boolean' },
  { description: 'Color mode: auto, always, or never', flags: '--color <mode>', id: 'color', value: 'string' },
  {
    description: 'Log level: silent, error, warn, info, or debug',
    flags: '--log-level <level>',
    id: 'logLevel',
    value: 'string',
  },
  { description: 'Show what would happen without making changes', flags: '--dry-run', id: 'dryRun', value: 'boolean' },
  {
    description: 'Refresh cached version metadata before returning results',
    flags: '--refresh',
    id: 'refresh',
    value: 'boolean',
  },
  {
    commanderProperty: 'cache',
    description: 'Bypass the local version cache for this command',
    flags: '--no-cache',
    id: 'noCache',
    negateCommanderValue: true,
    value: 'boolean',
  },
  {
    description: 'Attach a run id to structured output and logs',
    flags: '--run-id <id>',
    id: 'runId',
    value: 'string',
  },
  {
    description: 'Deduplicate repeated mutating requests by client-supplied key',
    flags: '--idempotency-key <key>',
    id: 'idempotencyKey',
    value: 'string',
  },
  {
    description: 'Abort a command after the given duration, e.g. 500ms, 30s, 5m',
    flags: '--timeout <duration>',
    id: 'timeout',
    value: 'string',
  },
]

const globalOptionDefinitionsById = new Map(globalOptionDefinitions.map(option => [option.id, option]))
const schemaDocumentsByName = new Map(schemaDocuments.map(schema => [schema.name, schema]))

const readOnlyGlobalOptions = [
  'json',
  'output',
  'quiet',
  'color',
  'logLevel',
  'refresh',
  'noCache',
  'timeout',
] as const satisfies readonly GlobalOptionId[]

const mutationGlobalOptions = [
  'json',
  'output',
  'yes',
  'quiet',
  'color',
  'logLevel',
  'dryRun',
  'timeout',
  'idempotencyKey',
] as const satisfies readonly GlobalOptionId[]

const commandContracts: readonly CommandContract[] = [
  defineCommandContract({
    aliases: [],
    description: '查看当前环境与 surface 能力',
    effects: ['filesystem', 'network', 'process'],
    globalOptions: ['json', 'output', 'nonInteractive', 'quiet', 'color', 'logLevel', 'refresh', 'noCache', 'timeout'],
    name: 'capabilities',
    summary: 'Return environment and surface capabilities',
  }),
  defineCommandContract({
    aliases: [],
    description: '查看命令目录与稳定能力',
    effects: [],
    globalOptions: ['json', 'output', 'quiet', 'color', 'logLevel', 'timeout'],
    name: 'commands',
    summary: 'Return the stable command catalog',
  }),
  defineCommandContract({
    aliases: [],
    arguments: [
      { description: 'Action: get, set, reset', name: 'action', syntax: '[action]' },
      { description: 'Config key', name: 'key', syntax: '[key]' },
      { description: 'Config value', name: 'value', syntax: '[value]' },
    ],
    catalogTokens: ['get', 'set', 'reset'],
    description: '配置管理',
    effects: ['filesystem', 'mutation'],
    globalOptions: ['json', 'output', 'quiet', 'color', 'logLevel', 'timeout'],
    name: 'config',
    summary: 'Read and modify Quantex configuration',
  }),
  defineCommandContract({
    aliases: [],
    description: '检查环境',
    effects: ['filesystem', 'network', 'process'],
    globalOptions: readOnlyGlobalOptions,
    name: 'doctor',
    summary: 'Diagnose the current environment and installed tools',
  }),
  defineCommandContract({
    aliases: [],
    allowUnknownOptions: true,
    arguments: [
      { description: 'Agent name or alias', name: 'agent', syntax: '<agent>' },
      { description: 'Arguments passed through to the agent', name: 'args', syntax: '[args...]' },
    ],
    description: '以显式策略启动 agent',
    effects: ['filesystem', 'interaction', 'mutation', 'network', 'process'],
    globalOptions: ['nonInteractive', 'yes', 'quiet', 'color', 'logLevel', 'dryRun', 'output'],
    name: 'exec',
    options: [
      {
        defaultValue: 'never',
        description: 'Install policy: never, if-missing, always',
        flags: '--install <policy>',
        id: 'install',
        value: 'string',
      },
    ],
    summary: 'Run an agent with explicit install policy',
  }),
  defineCommandContract({
    aliases: [],
    arguments: [{ description: 'Agent name or alias', name: 'agent', syntax: '<agent>' }],
    description: '确保指定 agent 已安装',
    effects: ['filesystem', 'interaction', 'mutation', 'network', 'process'],
    globalOptions: mutationGlobalOptions,
    name: 'ensure',
    summary: 'Ensure an agent is installed',
  }),
  defineCommandContract({
    aliases: [],
    arguments: [{ description: 'Agent name or alias', name: 'agent', syntax: '<agent>' }],
    description: '查看 agent 详细信息',
    effects: ['filesystem', 'network', 'process'],
    globalOptions: readOnlyGlobalOptions,
    name: 'info',
    summary: 'Show human-friendly agent details',
  }),
  defineCommandContract({
    aliases: [],
    arguments: [{ description: 'Agent name or alias', name: 'agent', syntax: '<agent>' }],
    description: '查看 agent 结构化状态',
    effects: ['filesystem', 'network', 'process'],
    globalOptions: readOnlyGlobalOptions,
    name: 'inspect',
    summary: 'Return structured agent state',
  }),
  defineCommandContract({
    aliases: ['i'],
    arguments: [{ description: 'Agent names or aliases', name: 'agents', syntax: '<agents...>' }],
    description: '安装指定 agent',
    effects: ['filesystem', 'interaction', 'mutation', 'network', 'process'],
    globalOptions: mutationGlobalOptions,
    name: 'install',
    summary: 'Install one or more agents',
  }),
  defineCommandContract({
    aliases: ['ls'],
    description: '列出所有支持的 agent',
    effects: ['filesystem', 'network', 'process'],
    globalOptions: readOnlyGlobalOptions,
    name: 'list',
    summary: 'List supported agents',
  }),
  defineCommandContract({
    aliases: [],
    arguments: [{ description: 'Agent name or alias', name: 'agent', syntax: '<agent>' }],
    description: '解析 agent 可执行入口',
    effects: ['filesystem', 'network', 'process'],
    globalOptions: readOnlyGlobalOptions,
    name: 'resolve',
    summary: 'Resolve an agent executable entrypoint',
  }),
  defineCommandContract({
    aliases: [],
    arguments: [{ description: 'Optional command name', name: 'command', syntax: '[command]' }],
    description: '查看结构化输出 schema',
    effects: [],
    globalOptions: ['json', 'output', 'quiet', 'color', 'logLevel', 'timeout'],
    name: 'schema',
    summary: 'Return structured output schemas',
  }),
  defineCommandContract({
    aliases: ['u'],
    arguments: [{ description: 'Agent name or alias', name: 'agent', syntax: '[agent]' }],
    description: '更新指定 agent',
    effects: ['filesystem', 'mutation', 'network', 'process'],
    globalOptions: [
      'json',
      'output',
      'quiet',
      'color',
      'logLevel',
      'dryRun',
      'refresh',
      'noCache',
      'timeout',
      'idempotencyKey',
    ],
    name: 'update',
    options: [{ description: 'Update all installed agents', flags: '--all', id: 'all', value: 'boolean' }],
    summary: 'Update one or all agents',
  }),
  defineCommandContract({
    aliases: ['rm'],
    arguments: [{ description: 'Agent name or alias', name: 'agent', syntax: '<agent>' }],
    description: '卸载指定 agent',
    effects: ['filesystem', 'mutation', 'process'],
    globalOptions: ['json', 'output', 'quiet', 'color', 'logLevel', 'dryRun', 'timeout', 'idempotencyKey'],
    name: 'uninstall',
    summary: 'Uninstall an agent',
  }),
  defineCommandContract({
    aliases: [],
    description: '升级 Quantex CLI',
    effects: ['filesystem', 'mutation', 'network', 'process'],
    globalOptions: [
      'json',
      'output',
      'quiet',
      'color',
      'logLevel',
      'dryRun',
      'refresh',
      'noCache',
      'timeout',
      'idempotencyKey',
    ],
    name: 'upgrade',
    options: [
      { description: 'Only check whether an update is available', flags: '--check', id: 'check', value: 'boolean' },
      { description: 'Update channel: stable or beta', flags: '--channel <channel>', id: 'channel', value: 'string' },
    ],
    summary: 'Upgrade Quantex CLI itself',
  }),
]

export function getCommandContracts(): readonly CommandContract[] {
  return commandContracts
}

export function getGlobalOptionDefinitions(): readonly GlobalOptionDefinition[] {
  return globalOptionDefinitions
}

export function normalizeCommanderGlobalOptions(options: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...options }
  for (const definition of globalOptionDefinitions) {
    const property = definition.commanderProperty ?? definition.id
    if (!(property in options)) continue
    normalized[definition.id] = definition.negateCommanderValue ? options[property] === false : options[property]
    if (property !== definition.id) delete normalized[property]
  }
  return normalized
}

export function toV1CommandDescriptor(contract: CommandContract): V1CommandDescriptor {
  return {
    flags: getV1CommandFlags(contract),
    name: contract.name,
    outputSchemaRef: `#/commands/${contract.schema.name}`,
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
    const argumentNames = new Set<string>()
    const optionFlags = new Set<string>()
    const optionIds = new Set<string>()

    for (const alias of contract.aliases) {
      if (names.has(alias)) throw new Error(`Command alias collides with command name: ${alias}`)
      if (aliases.has(alias)) throw new Error(`Duplicate command alias: ${alias}`)
      aliases.add(alias)
    }

    for (const effect of contract.effects) {
      if (effects.has(effect)) throw new Error(`Duplicate command effect: ${effect}`)
      effects.add(effect)
    }

    for (const [index, argument] of contract.arguments.entries()) {
      if (argumentNames.has(argument.name)) {
        throw new Error(`Duplicate command argument: ${contract.name} ${argument.name}`)
      }
      argumentNames.add(argument.name)
      if (argument.syntax.includes('...') && index !== contract.arguments.length - 1) {
        throw new Error(`Variadic command argument must be last: ${contract.name} ${argument.name}`)
      }
    }

    const inheritedOptionFlags = new Set<string>()
    for (const optionId of contract.globalOptions) {
      const option = globalOptionDefinitionsById.get(optionId)
      if (!option) throw new Error(`Unknown global option: ${contract.name} ${optionId}`)
      const flag = getLongOptionFlag(option.flags)
      if (inheritedOptionFlags.has(flag)) throw new Error(`Duplicate command global option: ${contract.name} ${flag}`)
      inheritedOptionFlags.add(flag)
    }

    for (const option of contract.options) {
      const flag = getLongOptionFlag(option.flags)
      if (optionFlags.has(flag)) throw new Error(`Duplicate command option: ${contract.name} ${flag}`)
      if (optionIds.has(option.id)) throw new Error(`Duplicate command option id: ${contract.name} ${option.id}`)
      if (inheritedOptionFlags.has(flag)) {
        throw new Error(`Command option duplicates global option: ${contract.name} ${flag}`)
      }
      validateOptionDefinition(option, contract.name)
      optionFlags.add(flag)
      optionIds.add(option.id)
    }

    const mutationSensitive =
      contract.globalOptions.includes('dryRun') ||
      contract.globalOptions.includes('idempotencyKey') ||
      contract.options.some(option => option.id === 'dryRun' || option.id === 'idempotencyKey')
    if (mutationSensitive && !effects.has('mutation')) {
      const option = contract.globalOptions.includes('dryRun') ? '--dry-run' : '--idempotency-key'
      throw new Error(`Command effect mismatch: ${contract.name} exposes ${option} without mutation`)
    }

    const projectedFlags = getV1CommandFlags(contract)
    if (
      projectedFlags.length !== contract.flags.length ||
      projectedFlags.some((flag, index) => flag !== contract.flags[index])
    ) {
      throw new Error(`Command discovery option mismatch: ${contract.name}`)
    }
  }

  for (const contract of contracts) {
    if (!names.has(contract.handlerId)) throw new Error(`Unresolved command handler: ${contract.handlerId}`)
    if (!names.has(contract.presenterId)) throw new Error(`Unresolved command presenter: ${contract.presenterId}`)
  }

  const availableSchemas = new Set(schemaNames)
  for (const contract of contracts) {
    if (!availableSchemas.has(contract.schemaName)) throw new Error(`Missing command schema: ${contract.schemaName}`)
    if (contract.schema.name !== contract.schemaName) {
      throw new Error(`Command schema mismatch: ${contract.name} ${contract.schema.name}`)
    }
  }
}

function defineCommandContract(definition: CommandContractDefinition): CommandContract {
  const schema = getRequiredSchema(definition.name)
  const contract: CommandContract = {
    ...definition,
    arguments: definition.arguments ?? [],
    catalogTokens: definition.catalogTokens ?? [],
    flags: [],
    handlerId: definition.name,
    options: definition.options ?? [],
    presenterId: definition.name,
    schema,
    schemaName: definition.name,
    stability: 'stable',
  }
  return { ...contract, flags: getV1CommandFlags(contract) }
}

function getRequiredSchema(name: StableCommandName): SchemaDocument {
  const schema = schemaDocumentsByName.get(name)
  if (!schema) throw new Error(`Missing command schema: ${name}`)
  return schema
}

function getV1CommandFlags(contract: CommandContract): string[] {
  return [
    ...contract.catalogTokens,
    ...contract.options.map(option => getLongOptionFlag(option.flags)),
    ...contract.globalOptions.map(optionId => {
      const option = globalOptionDefinitionsById.get(optionId)
      if (!option) throw new Error(`Unknown global option: ${contract.name} ${optionId}`)
      return getLongOptionFlag(option.flags)
    }),
  ]
}

function getLongOptionFlag(flags: string): string {
  const match = flags.match(/--[a-z][a-z-]*/)
  if (!match) throw new Error(`Command option requires a long flag: ${flags}`)
  return match[0]
}

function validateOptionDefinition(option: CommandOptionDefinition, commandName: string): void {
  const hasValueSyntax = option.flags.includes('<') || option.flags.includes('[')
  if ((option.value === 'string') !== hasValueSyntax) {
    throw new Error(`Command option value mismatch: ${commandName} ${getLongOptionFlag(option.flags)}`)
  }
  if (option.value === 'boolean' && typeof option.defaultValue === 'string') {
    throw new Error(`Command option default mismatch: ${commandName} ${getLongOptionFlag(option.flags)}`)
  }
}
