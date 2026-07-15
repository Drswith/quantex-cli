import type { NetworkPort } from '../../src/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCliContext, setCliContext } from '../../src/cli-context'
import { fetchBinaryReleaseManifest } from '../../src/self/release'
import { getLatestVersion } from '../../src/utils/version'

describe('self-upgrade fresh checks through NetworkPort', () => {
  beforeEach(() => {
    setCliContext({ cacheMode: 'no-cache', interactive: false, outputMode: 'json', runId: 'self-network-port' })
  })

  afterEach(() => {
    resetCliContext()
  })

  it('resolves registry metadata through the injected port', async () => {
    const request = vi.fn(async () => ({
      kind: 'success' as const,
      value: {
        body: new TextEncoder().encode('{"version":"1.2.3"}'),
        headers: {},
        status: 200,
      },
    }))

    await expect(
      getLatestVersion('quantex-cli', 'latest', {
        networkPort: { request },
        registry: 'https://registry.example',
      }),
    ).resolves.toBe('1.2.3')
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        url: 'https://registry.example/quantex-cli/latest',
      }),
    )
  })

  it('resolves a stable binary manifest through the injected port', async () => {
    const manifest = { assets: [], channel: 'stable', version: '1.2.3' }
    const port: NetworkPort = {
      request: async () => ({
        kind: 'success',
        value: { body: new TextEncoder().encode(JSON.stringify(manifest)), headers: {}, status: 200 },
      }),
    }

    await expect(fetchBinaryReleaseManifest('stable', undefined, port)).resolves.toEqual(manifest)
  })
})
