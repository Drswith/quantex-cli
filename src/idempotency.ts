import type { CommandResult, CommandTarget } from './output/types'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getConfigDir } from './config'
import {
  IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  parseIdempotencyRecord,
  type InvalidIdempotencyRecordReason,
  type VersionedIdempotencyRecord,
} from './idempotency/schema'

const idempotencyTtlMs = 24 * 60 * 60 * 1000

export type VersionedIdempotencyRecordInput = Omit<
  VersionedIdempotencyRecord,
  'createdAt' | 'expiresAt' | 'schemaVersion'
>

export interface VersionedIdempotencyLoadOptions {
  readonly now?: () => Date
}

export interface VersionedIdempotencyStorageOptions extends VersionedIdempotencyLoadOptions {
  readonly fileSystem?: VersionedIdempotencyFileSystem
  readonly ttlMs?: number
}

export interface VersionedIdempotencyFileSystem {
  readonly writeFile: (path: string, data: string, encoding: 'utf8') => Promise<void>
}

export type VersionedIdempotencyLoadResult =
  | { readonly kind: 'missing' }
  | { readonly kind: 'expired'; readonly record: VersionedIdempotencyRecord }
  | { readonly kind: 'invalid'; readonly reason: InvalidIdempotencyRecordReason | 'invalid-json' }
  | { readonly kind: 'valid'; readonly record: VersionedIdempotencyRecord }

export interface IdempotencyRecord {
  action: string
  createdAt: string
  expiresAt: string
  result: CommandResult
  target?: CommandTarget
}

export function getIdempotencyDir(): string {
  return join(getConfigDir(), 'idempotency')
}

export function getIdempotencyFilePath(key: string): string {
  return join(getIdempotencyDir(), `${digestIdempotencyKey(key)}.json`)
}

export async function loadIdempotencyRecord(key: string): Promise<IdempotencyRecord | undefined> {
  try {
    const record = JSON.parse(await readFile(getIdempotencyFilePath(key), 'utf8')) as IdempotencyRecord
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await rm(getIdempotencyFilePath(key), { force: true })
      return undefined
    }

    return record
  } catch {
    return undefined
  }
}

export async function saveIdempotencyRecord(
  key: string,
  record: { action: string; result: CommandResult; target?: CommandTarget },
): Promise<void> {
  await mkdir(getIdempotencyDir(), { recursive: true })
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + idempotencyTtlMs).toISOString()
  const storedRecord: IdempotencyRecord = {
    action: record.action,
    createdAt,
    expiresAt,
    result: record.result,
    target: record.target,
  }
  await writeFile(getIdempotencyFilePath(key), `${JSON.stringify(storedRecord, null, 2)}\n`, 'utf8')
}

export async function loadVersionedIdempotencyRecord(
  key: string,
  options: VersionedIdempotencyLoadOptions = {},
): Promise<VersionedIdempotencyLoadResult> {
  const path = getIdempotencyFilePath(key)
  let serialized: string
  try {
    serialized = await readFile(path, 'utf8')
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return { kind: 'missing' }
    throw error
  }

  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    return { kind: 'invalid', reason: 'invalid-json' }
  }

  const parsed = parseIdempotencyRecord(value)
  if (parsed.kind === 'invalid') return parsed
  if (Date.parse(parsed.record.expiresAt) <= getNow(options).getTime()) {
    await rm(path)
    return { kind: 'expired', record: parsed.record }
  }

  return parsed
}

export async function saveVersionedIdempotencyRecord(
  key: string,
  input: VersionedIdempotencyRecordInput,
  options: VersionedIdempotencyStorageOptions = {},
): Promise<void> {
  const now = getNow(options)
  const ttlMs = options.ttlMs ?? idempotencyTtlMs
  const record: VersionedIdempotencyRecord = {
    ...input,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  }
  const parsed = parseIdempotencyRecord(record)
  if (parsed.kind === 'invalid') {
    throw new TypeError(`Invalid versioned idempotency record: ${parsed.reason}`)
  }

  const directory = getIdempotencyDir()
  const finalPath = getIdempotencyFilePath(key)
  const temporaryPath = `${finalPath}.${process.pid}.${randomUUID()}.tmp`
  const writeTemporaryFile = options.fileSystem?.writeFile ?? writeFile
  await mkdir(directory, { recursive: true })
  try {
    await writeTemporaryFile(temporaryPath, serializeIdempotencyRecord(parsed.record), 'utf8')
    await rename(temporaryPath, finalPath)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

function digestIdempotencyKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

function getNow(options: VersionedIdempotencyLoadOptions): Date {
  const now = options.now?.() ?? new Date()
  if (!Number.isFinite(now.getTime())) throw new TypeError('Idempotency clock must return a valid date.')
  return now
}

function serializeIdempotencyRecord(record: VersionedIdempotencyRecord): string {
  return `${JSON.stringify(
    record,
    (_key, value: unknown) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, (value as Record<string, unknown>)[key]]),
      )
    },
    2,
  )}\n`
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
