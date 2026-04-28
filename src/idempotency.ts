import type { CommandResult, CommandTarget } from './output/types'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getConfigDir } from './config'

const idempotencyTtlMs = 24 * 60 * 60 * 1000

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
  return join(getIdempotencyDir(), `${sanitizeIdempotencyKey(key)}.json`)
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

function sanitizeIdempotencyKey(key: string): string {
  return key.replace(/[^\w.-]/g, '_')
}
