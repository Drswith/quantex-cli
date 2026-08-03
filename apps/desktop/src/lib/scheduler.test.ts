import { describe, expect, it } from 'vitest'
import { nextCheckDelay, notificationKeys } from './scheduler'

describe('desktop background policy', () => {
  it('uses the configured cadence and bounded retry backoff', () => {
    expect(nextCheckDelay('daily')).toBe(24 * 60 * 60 * 1000)
    expect(nextCheckDelay('daily', 1)).toBe(15 * 60 * 1000)
    expect(nextCheckDelay('daily', 2)).toBe(60 * 60 * 1000)
    expect(nextCheckDelay('disabled')).toBeUndefined()
  })

  it('only creates notification keys for new planned versions', () => {
    expect(
      notificationKeys([
        { latestVersion: '2.0.0', name: 'codex', status: 'planned' },
        { latestVersion: '1.0.0', name: 'claude', status: 'up-to-date' },
      ]),
    ).toEqual(['codex@2.0.0'])
  })
})
