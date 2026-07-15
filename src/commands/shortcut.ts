import type { GlobalOptionId } from '../command-contract'
import { getGlobalOptionDefinitions } from '../command-contract'

export interface ShortcutInvocation {
  agentArgs: string[]
  agentName: string
  color?: string
  dryRun?: boolean
  error?: string
  idempotencyKey?: string
  logLevel?: string
  noCache?: boolean
  nonInteractive?: boolean
  quiet?: boolean
  refresh?: boolean
  runId?: string
  timeout?: string
  yes?: boolean
}

export interface ResolveShortcutInvocationOptions {
  readonly agentFriendly: boolean
}

type ParsedGlobalOptions = Partial<Record<GlobalOptionId, boolean | string>>

const globalOptionsByFlag = new Map(
  getGlobalOptionDefinitions().map(option => [getLongOptionFlag(option.flags), option]),
)

export function resolveShortcutInvocation(
  argv: string[],
  knownCommandNames: Set<string>,
  options: ResolveShortcutInvocationOptions,
): ShortcutInvocation | undefined {
  const parsed: ParsedGlobalOptions = {}
  let index = 0

  while (index < argv.length) {
    const arg = argv[index]!
    const option = globalOptionsByFlag.get(arg)
    if (option) {
      if (option.value === 'string') {
        const value = argv[index + 1]
        if (!value) return missingValue(arg)
        parsed[option.id] = value
        index += 2
      } else {
        parsed[option.id] = true
        index += 1
      }
      continue
    }

    if (arg.startsWith('-') || knownCommandNames.has(arg)) return undefined

    const outputMode = asString(parsed.output)
    if (
      parsed.json === true ||
      outputMode === 'json' ||
      outputMode === 'ndjson' ||
      (options.agentFriendly && outputMode !== 'human')
    ) {
      return {
        agentArgs: [],
        agentName: '',
        error: 'Structured output is not supported for shortcut agent execution yet. Use a management command instead.',
      }
    }

    return {
      agentArgs: argv.slice(index + 1),
      agentName: arg,
      color: asString(parsed.color),
      dryRun: asBoolean(parsed.dryRun),
      idempotencyKey: asString(parsed.idempotencyKey),
      logLevel: asString(parsed.logLevel),
      noCache: asBoolean(parsed.noCache),
      nonInteractive: asBoolean(parsed.nonInteractive),
      quiet: asBoolean(parsed.quiet),
      refresh: asBoolean(parsed.refresh),
      runId: asString(parsed.runId),
      timeout: asString(parsed.timeout),
      yes: asBoolean(parsed.yes),
    }
  }

  return undefined
}

function getLongOptionFlag(flags: string): string {
  const match = flags.match(/--[a-z][a-z-]*/)
  if (!match) throw new Error(`Global option requires a long flag: ${flags}`)
  return match[0]
}

function asBoolean(value: boolean | string | undefined): boolean {
  return value === true
}

function asString(value: boolean | string | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function missingValue(option: string): ShortcutInvocation {
  return { agentArgs: [], agentName: '', error: `${option} requires a value` }
}
