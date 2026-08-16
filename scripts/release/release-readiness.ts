const deferredStableMajor = 2

export const deferredStableReleaseReason =
  'Stable 2.x releases are deferred until the required v2 refactor has merged and completed at least 90 days of stabilization under a reviewed OpenSpec readiness change.'

export function getStableReleaseReadinessIssue(version: string): string | null {
  const match = version.trim().match(/^(\d+)\.\d+\.\d+$/)
  if (!match || Number(match[1]) !== deferredStableMajor) return null

  return deferredStableReleaseReason
}

export function assertStableReleaseReady(version: string): void {
  const issue = getStableReleaseReadinessIssue(version)
  if (issue) throw new Error(issue)
}
