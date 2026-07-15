import type { CachePort, RuntimeOutcome } from '../runtime'
import type { SelfInstallFacts, SelfInstallSource, SelfUpdateChannel } from './types'
import { compareVersions } from '../utils/version'

export const SELF_UPDATE_METADATA_SCHEMA_VERSION = 1 as const

export interface SelfUpdateMetadata {
  readonly canAutoUpdate: true
  readonly expiresAtMs: number
  readonly fetchedAtMs: number
  readonly installSource: SelfInstallSource
  readonly schemaVersion: typeof SELF_UPDATE_METADATA_SCHEMA_VERSION
  readonly targetVersion: string
  readonly updateChannel: SelfUpdateChannel
}

export function getSelfUpdateMetadataCacheKey(
  facts: Pick<SelfInstallFacts, 'installSource' | 'updateChannel'>,
): string {
  return `self:update-metadata:${facts.installSource}:${facts.updateChannel}`
}

export function createSelfUpdateMetadata(input: {
  readonly expiresAtMs: number
  readonly facts: SelfInstallFacts
  readonly fetchedAtMs: number
  readonly targetVersion: string
}): SelfUpdateMetadata {
  return {
    canAutoUpdate: true,
    expiresAtMs: input.expiresAtMs,
    fetchedAtMs: input.fetchedAtMs,
    installSource: input.facts.installSource,
    schemaVersion: SELF_UPDATE_METADATA_SCHEMA_VERSION,
    targetVersion: input.targetVersion,
    updateChannel: input.facts.updateChannel,
  }
}

export function parseSelfUpdateMetadata(
  value: unknown,
  input: { readonly facts: SelfInstallFacts; readonly nowMs: number },
): SelfUpdateMetadata | undefined {
  if (!isRecord(value)) return undefined
  if (value.schemaVersion !== SELF_UPDATE_METADATA_SCHEMA_VERSION) return undefined
  if (value.canAutoUpdate !== true || !input.facts.canAutoUpdate) return undefined
  if (value.installSource !== input.facts.installSource || value.updateChannel !== input.facts.updateChannel)
    return undefined
  if (typeof value.targetVersion !== 'string' || compareVersions(value.targetVersion, value.targetVersion) !== 0)
    return undefined
  if (!isTimestamp(value.fetchedAtMs) || !isTimestamp(value.expiresAtMs)) return undefined
  if (value.fetchedAtMs > input.nowMs || value.expiresAtMs <= input.nowMs || value.fetchedAtMs >= value.expiresAtMs)
    return undefined

  return value as unknown as SelfUpdateMetadata
}

export async function readSelfUpdateMetadata(input: {
  readonly cache: CachePort
  readonly facts: SelfInstallFacts
  readonly nowMs: number
  readonly signal: AbortSignal
}): Promise<SelfUpdateMetadata | undefined> {
  const outcome = await input.cache.read({
    key: getSelfUpdateMetadataCacheKey(input.facts),
    signal: input.signal,
  })
  if (outcome.kind === 'failure' || outcome.value.kind === 'miss') return undefined
  if (outcome.value.expiresAtMs !== undefined && outcome.value.expiresAtMs <= input.nowMs) return undefined

  return parseSelfUpdateMetadata(outcome.value.value, input)
}

export function writeSelfUpdateMetadata(input: {
  readonly cache: CachePort
  readonly metadata: SelfUpdateMetadata
  readonly signal: AbortSignal
}): Promise<RuntimeOutcome<void>> {
  return input.cache.write({
    expiresAtMs: input.metadata.expiresAtMs,
    key: getSelfUpdateMetadataCacheKey(input.metadata),
    signal: input.signal,
    value: input.metadata,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
