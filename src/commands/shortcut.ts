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

export function resolveShortcutInvocation(
  argv: string[],
  knownCommandNames: Set<string>,
  options: ResolveShortcutInvocationOptions,
): ShortcutInvocation | undefined {
  let color: string | undefined
  let dryRun = false
  let index = 0
  let idempotencyKey: string | undefined
  let jsonOutputRequested = false
  let logLevel: string | undefined
  let noCache = false
  let nonInteractive = false
  let outputMode: string | undefined
  let quiet = false
  let refresh = false
  let runId: string | undefined
  let timeout: string | undefined
  let yes = false

  while (index < argv.length) {
    const arg = argv[index]

    if (arg === '--json') {
      jsonOutputRequested = true
      index += 1
      continue
    }

    if (arg === '--output') {
      const value = argv[index + 1]
      if (!value) return missingValue(arg)
      outputMode = value
      index += 2
      continue
    }

    if (arg === '--non-interactive') {
      nonInteractive = true
      index += 1
      continue
    }

    if (arg === '--yes') {
      yes = true
      index += 1
      continue
    }

    if (arg === '--quiet') {
      quiet = true
      index += 1
      continue
    }

    if (arg === '--color') {
      const value = argv[index + 1]
      if (!value) return missingValue(arg)
      color = value
      index += 2
      continue
    }

    if (arg === '--log-level') {
      const value = argv[index + 1]
      if (!value) return missingValue(arg)
      logLevel = value
      index += 2
      continue
    }

    if (arg === '--dry-run') {
      dryRun = true
      index += 1
      continue
    }

    if (arg === '--refresh') {
      refresh = true
      index += 1
      continue
    }

    if (arg === '--no-cache') {
      noCache = true
      index += 1
      continue
    }

    if (arg === '--idempotency-key') {
      const value = argv[index + 1]
      if (!value) return missingValue(arg)
      idempotencyKey = value
      index += 2
      continue
    }

    if (arg === '--run-id') {
      const value = argv[index + 1]
      if (!value) return missingValue(arg)
      runId = value
      index += 2
      continue
    }

    if (arg === '--timeout') {
      const value = argv[index + 1]
      if (!value) return missingValue(arg)
      timeout = value
      index += 2
      continue
    }

    if (arg.startsWith('-') || knownCommandNames.has(arg)) return undefined

    if (
      jsonOutputRequested ||
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
      color,
      dryRun,
      idempotencyKey,
      logLevel,
      noCache,
      nonInteractive,
      quiet,
      refresh,
      runId,
      timeout,
      yes,
    }
  }

  return undefined
}

function missingValue(option: string): ShortcutInvocation {
  return { agentArgs: [], agentName: '', error: `${option} requires a value` }
}
