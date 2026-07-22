import { describe, expect, it, vi } from 'vitest'

describe('Core public import purity', () => {
  it('does not perform network access or produce output during import', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network access'))
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      vi.resetModules()
      const core = await import('../../packages/core/src/index')

      expect(Object.keys(core)).toEqual(['createQuantex'])
      expect(fetch).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
      expect(stdout).not.toHaveBeenCalled()
      expect(stderr).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
      log.mockRestore()
      error.mockRestore()
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })
})
