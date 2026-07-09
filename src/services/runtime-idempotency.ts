import type { OutputMode } from '../cli-context'
import type { IdempotencyRecord } from '../idempotency'
import type { CommandResult, CommandTarget } from '../output/types'
import * as idempotencyStore from '../idempotency'
import * as agentService from './agents'

export interface RuntimeIdempotencyInvocation {
  action: string
  dryRun: boolean
  idempotencyKey?: string
  outputMode: OutputMode
  runId: string
  target?: CommandTarget
}

export type RuntimeIdempotencyOutcome<T> =
  | {
      kind: 'conflict'
      existingAction: string
      idempotencyKey: string
    }
  | {
      kind: 'miss'
    }
  | {
      kind: 'replay'
      result: CommandResult<T>
    }

export interface RuntimeIdempotencyDependencies {
  loadIdempotencyRecord: typeof idempotencyStore.loadIdempotencyRecord
  now: () => string
  resolveAgentInspection: typeof agentService.resolveAgentInspection
  saveIdempotencyRecord: typeof idempotencyStore.saveIdempotencyRecord
}

function createDefaultDependencies(): RuntimeIdempotencyDependencies {
  return {
    loadIdempotencyRecord: idempotencyStore.loadIdempotencyRecord,
    now: () => new Date().toISOString(),
    resolveAgentInspection: agentService.resolveAgentInspection,
    saveIdempotencyRecord: idempotencyStore.saveIdempotencyRecord,
  }
}

export async function resolveIdempotentExecution<T>(
  invocation: RuntimeIdempotencyInvocation,
  dependencies: RuntimeIdempotencyDependencies = createDefaultDependencies(),
): Promise<RuntimeIdempotencyOutcome<T>> {
  if (!invocation.idempotencyKey) return { kind: 'miss' }

  const record = await dependencies.loadIdempotencyRecord(invocation.idempotencyKey)
  if (!record) return { kind: 'miss' }

  if (record.action !== invocation.action) {
    return {
      existingAction: record.action,
      idempotencyKey: invocation.idempotencyKey,
      kind: 'conflict',
    }
  }

  if (!idempotencyTargetsMatch(record.target, invocation.target)) return { kind: 'miss' }
  if (isDryRunIdempotencyResult(record.result)) return { kind: 'miss' }
  if (!(await isStoredIdempotencyResultStillValid(record, dependencies))) return { kind: 'miss' }

  return {
    kind: 'replay',
    result: {
      ...record.result,
      meta: {
        ...record.result.meta,
        mode: invocation.outputMode,
        runId: invocation.runId,
        timestamp: dependencies.now(),
      },
    } as CommandResult<T>,
  }
}

export async function persistIdempotentExecution<T>(
  invocation: RuntimeIdempotencyInvocation,
  result: CommandResult<T>,
  dependencies: RuntimeIdempotencyDependencies = createDefaultDependencies(),
): Promise<void> {
  if (!invocation.idempotencyKey || !result.ok || invocation.dryRun || isDryRunIdempotencyResult(result)) {
    return
  }

  await dependencies.saveIdempotencyRecord(invocation.idempotencyKey, {
    action: invocation.action,
    result,
    target: invocation.target,
  })
}

function idempotencyTargetsMatch(stored?: CommandTarget, requested?: CommandTarget): boolean {
  if (stored === undefined && requested === undefined) return true
  if (stored === undefined || requested === undefined) return false
  if (stored.kind !== requested.kind) return false
  if (stored.kind === 'agent' && (!stored.name || !requested.name)) return false
  return stored.name === requested.name
}

function isDryRunIdempotencyResult(result: CommandResult): boolean {
  return result.warnings.some(warning => warning.code === 'DRY_RUN')
}

const agentPresenceRequiredActions = new Set(['install', 'ensure', 'update'])
const agentAbsenceRequiredActions = new Set(['uninstall'])

function getIdempotencyAgentNames(target?: CommandTarget): string[] | undefined {
  if (target?.kind !== 'agent' || !target.name) return undefined

  return target.name
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
}

async function isStoredIdempotencyResultStillValid(
  record: IdempotencyRecord,
  dependencies: RuntimeIdempotencyDependencies,
): Promise<boolean> {
  if (!record.result.ok) return true

  const agentNames = getIdempotencyAgentNames(record.target)
  if (!agentNames || agentNames.length === 0) return true

  if (agentPresenceRequiredActions.has(record.action)) {
    for (const agentName of agentNames) {
      const resolved = await dependencies.resolveAgentInspection(agentName)
      if (!resolved?.inspection.inPath) return false
    }

    return true
  }

  if (agentAbsenceRequiredActions.has(record.action)) {
    for (const agentName of agentNames) {
      const resolved = await dependencies.resolveAgentInspection(agentName)
      if (resolved?.inspection.inPath) return false
    }

    return true
  }

  return true
}
