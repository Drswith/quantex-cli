import type { CheckFrequency } from './types'

const frequencyMs: Record<Exclude<CheckFrequency, 'disabled'>, number> = {
  '6h': 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

export function nextCheckDelay(frequency: CheckFrequency, retryAttempt = 0): number | undefined {
  if (frequency === 'disabled') return undefined
  if (retryAttempt === 1) return 15 * 60 * 1000
  if (retryAttempt >= 2) return 60 * 60 * 1000
  return frequencyMs[frequency]
}

export function notificationKeys(results: Array<{ latestVersion?: string; name: string; status: string }>): string[] {
  return results
    .filter(result => result.status === 'planned' && result.latestVersion)
    .map(result => `${result.name}@${result.latestVersion}`)
    .sort()
}
