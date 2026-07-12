import { describe, expect, it, vi } from 'vitest'
import { waitForUninstallAbsence } from '../../src/lifecycle/uninstall-postcondition'

describe('waitForUninstallAbsence', () => {
  it('allows bounded provider and executable visibility delay', async () => {
    const probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const delay = vi.fn(async () => {})

    await expect(
      waitForUninstallAbsence(probe, {
        attempts: 3,
        delay,
        delayMs: 25,
      }),
    ).resolves.toBe(true)
    expect(probe).toHaveBeenCalledTimes(3)
    expect(delay).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the executable remains visible or cancellation is requested', async () => {
    const probe = vi.fn(async () => false)
    let cancelled = false
    const delay = vi.fn(async () => {
      cancelled = true
    })

    await expect(
      waitForUninstallAbsence(probe, {
        attempts: 3,
        delay,
        delayMs: 25,
        isCancelled: () => cancelled,
      }),
    ).resolves.toBe(false)
    expect(probe).toHaveBeenCalledOnce()
  })

  it('does not accept absence observed concurrently with cancellation', async () => {
    let cancelled = false

    await expect(
      waitForUninstallAbsence(
        async () => {
          cancelled = true
          return true
        },
        { isCancelled: () => cancelled },
      ),
    ).resolves.toBe(false)
  })
})
