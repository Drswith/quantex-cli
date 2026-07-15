import type { CachePort } from '../runtime'
import type { SelfInstallFacts } from './types'
import { getCliContext } from '../cli-context'
import { createVersionCachePort } from '../runtime'
import { getSelfState } from '../state'
import { pc } from '../utils/color'
import { printInfo } from '../utils/user-output'
import { isVersionNewer } from '../utils/version'
import { resolveSelfInstallFactsReadOnly } from './facts'
import { readSelfUpdateMetadata } from './update-metadata'

const UPDATE_NOTICE_THROTTLE_MS = 24 * 60 * 60 * 1000
const SELF_UPGRADE_NOTICE_SKIPPED_ACTIONS = new Set(['doctor', 'upgrade'])

interface SelfUpdateNoticeDependencies {
  readonly cache: CachePort
  readonly getSelfState: typeof getSelfState
  readonly now: () => number
  readonly resolveFacts: () => Promise<SelfInstallFacts>
}

export async function maybeRenderSelfUpdateNotice(
  options: { action: string; ok: boolean },
  dependencies: SelfUpdateNoticeDependencies = {
    cache: createVersionCachePort(),
    getSelfState,
    now: Date.now,
    resolveFacts: resolveSelfInstallFactsReadOnly,
  },
): Promise<void> {
  if (!options.ok || SELF_UPGRADE_NOTICE_SKIPPED_ACTIONS.has(options.action)) return

  const context = getCliContext()
  if (context.outputMode !== 'human' || context.quiet) return

  const facts = await dependencies.resolveFacts()
  const now = dependencies.now()
  const metadata = await readSelfUpdateMetadata({
    cache: dependencies.cache,
    facts,
    nowMs: now,
    signal: new AbortController().signal,
  })
  if (!metadata || !isVersionNewer(metadata.targetVersion, facts.currentVersion)) return

  const selfState = await dependencies.getSelfState()

  if (shouldSuppressUpdateNotice(selfState.updateNoticeVersion, selfState.updateNoticeAt, metadata.targetVersion, now))
    return

  const nextStep = 'Run `quantex upgrade`.'
  printInfo(
    pc.yellow(`Quantex CLI ${metadata.targetVersion} is available (current ${facts.currentVersion}). ${nextStep}`),
  )
}

export function shouldSuppressUpdateNotice(
  lastVersion: string | undefined,
  lastAt: string | undefined,
  nextVersion: string,
  now: number,
): boolean {
  if (!lastVersion || !lastAt || lastVersion !== nextVersion) return false

  const lastTimestamp = Date.parse(lastAt)
  if (Number.isNaN(lastTimestamp)) return false

  return now - lastTimestamp < UPDATE_NOTICE_THROTTLE_MS
}
