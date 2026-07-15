import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFetchNetworkPort } from '../../src/runtime/fetch-network'

afterEach(() => {
  vi.useRealTimers()
})

describe('createFetchNetworkPort', () => {
  it('returns status, normalized headers, and response bytes', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{"version":"1.2.3"}', {
          headers: { 'content-type': 'application/json', etag: 'test-etag' },
          status: 200,
        }),
    )
    const port = createFetchNetworkPort({ fetch })

    const outcome = await port.request({
      headers: { 'if-none-match': 'old-etag' },
      signal: new AbortController().signal,
      timeoutMs: 1_000,
      url: 'https://registry.example/quantex/latest',
    })

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        body: new TextEncoder().encode('{"version":"1.2.3"}'),
        headers: expect.objectContaining({ 'content-type': 'application/json', etag: 'test-etag' }),
        status: 200,
      },
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://registry.example/quantex/latest',
      expect.objectContaining({ headers: { 'if-none-match': 'old-etag' }, signal: expect.any(AbortSignal) }),
    )
  })

  it('returns cancellation without waiting for an uncooperative fetch', async () => {
    const controller = new AbortController()
    const port = createFetchNetworkPort({ fetch: vi.fn(() => new Promise<Response>(() => {})) })
    const running = port.request({ signal: controller.signal, url: 'https://registry.example/hang' })
    controller.abort('cancelled request')

    await expect(running).resolves.toEqual({
      error: { kind: 'cancelled', message: 'cancelled request' },
      kind: 'failure',
    })
  })

  it('returns a typed timeout and aborts the underlying request', async () => {
    vi.useFakeTimers()
    let fetchSignal: AbortSignal | undefined
    const port = createFetchNetworkPort({
      fetch: vi.fn((_url, init) => {
        fetchSignal = init?.signal as AbortSignal
        return new Promise<Response>(() => {})
      }),
    })
    const running = port.request({
      signal: new AbortController().signal,
      timeoutMs: 25,
      url: 'https://registry.example/hang',
    })
    await vi.advanceTimersByTimeAsync(25)

    await expect(running).resolves.toEqual({
      error: { kind: 'timed-out', message: 'Network request timed out after 25ms.' },
      kind: 'failure',
    })
    expect(fetchSignal?.aborted).toBe(true)
  })
})
