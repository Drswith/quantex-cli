import { getCliContext } from '../cli-context'
import { getSelfState, setSelfUpdateNoticeState } from '../state'
import { pc } from '../utils/color'
import { printInfo } from '../utils/user-output'
import { inspectSelf } from './index'

const UPDATE_NOTICE_THROTTLE_MS = 24 * 60 * 60 * 1000
const SELF_UPGRADE_NOTICE_SKIPPED_ACTIONS = new Set(['doctor', 'upgrade'])

export async function maybeRenderSelfUpdateNotice(options: { action: string; ok: boolean }): Promise<void> {
  if (!options.ok || SELF_UPGRADE_NOTICE_SKIPPED_ACTIONS.has(options.action)) return

  const context = getCliContext()
  if (context.outputMode !== 'human' || context.quiet) return

  const inspection = await inspectSelf()
  if (!inspection.latestVersion || inspection.latestVersion === inspection.currentVersion) return

  const selfState = await getSelfState()
  const now = Date.now()

  if (
    shouldSuppressUpdateNotice(selfState.updateNoticeVersion, selfState.updateNoticeAt, inspection.latestVersion, now)
  )
    return

  const nextStep = inspection.canAutoUpdate
    ? 'Run `quantex upgrade`.'
    : 'Run `quantex doctor` for source-specific update steps.'
  printInfo(
    pc.yellow(
      `Quantex CLI ${inspection.latestVersion} is available (current ${inspection.currentVersion}). ${nextStep}`,
    ),
  )
  await setSelfUpdateNoticeState(inspection.latestVersion, new Date(now).toISOString())
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
