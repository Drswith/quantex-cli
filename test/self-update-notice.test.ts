import type { CacheLookup, CachePort } from '../src/runtime'
import type { SelfInstallFacts } from '../src/self'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import * as selfModule from '../src/self'
import { createSelfUpdateMetadata, getSelfUpdateMetadataCacheKey } from '../src/self/update-metadata'
import { maybeRenderSelfUpdateNotice } from '../src/self/update-notice'
import * as state from '../src/state'

const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelfReadOnly')
const setSelfUpdateNoticeStateSpy = vi.spyOn(state, 'setSelfUpdateNoticeState')
const NOW = Date.parse('2026-07-15T10:00:00.000Z')
const facts: SelfInstallFacts = {
  canAutoUpdate: true,
  currentVersion: '0.15.0',
  executablePath: '/Users/test/.bun/bin/qtx',
  installSource: 'bun',
  packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
  updateChannel: 'stable',
}

describe('maybeRenderSelfUpdateNotice', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    inspectSelfSpy.mockClear()
    setSelfUpdateNoticeStateSpy.mockClear()
    setCliContext({
      colorMode: 'never',
      interactive: true,
      outputMode: 'human',
      runId: 'notice-run-id',
    })
  })

  afterEach(() => {
    stdoutWriteSpy.mockRestore()
  })

  it('suppresses passive notices when cached latest version is lower than current', async () => {
    const cache = createMetadataCache('0.14.0')

    await maybeRenderSelfUpdateNotice(
      { action: 'list', ok: true },
      { cache, getSelfState: async () => ({}), now: () => NOW, resolveFacts: async () => facts },
    )

    expect(stdoutWriteSpy).not.toHaveBeenCalled()
    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(setSelfUpdateNoticeStateSpy).not.toHaveBeenCalled()
  })

  it('renders the exact cached latest-version notice without fresh inspection or persistence', async () => {
    const cache = createMetadataCache('0.16.0')

    await maybeRenderSelfUpdateNotice(
      { action: 'list', ok: true },
      { cache, getSelfState: async () => ({}), now: () => NOW, resolveFacts: async () => facts },
    )

    expect(stdoutWriteSpy).toHaveBeenCalledOnce()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      'Quantex CLI 0.16.0 is available (current 0.15.0). Run `quantex upgrade`.\n',
    )
    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(setSelfUpdateNoticeStateSpy).not.toHaveBeenCalled()
  })

  it('stays silent on cache miss without attempting a fresh inspection', async () => {
    const cache = createCache({ kind: 'miss' })

    await maybeRenderSelfUpdateNotice(
      { action: 'list', ok: true },
      { cache, getSelfState: async () => ({}), now: () => NOW, resolveFacts: async () => facts },
    )

    expect(stdoutWriteSpy).not.toHaveBeenCalled()
    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(setSelfUpdateNoticeStateSpy).not.toHaveBeenCalled()
  })
})

function createMetadataCache(targetVersion: string): CachePort {
  const metadata = createSelfUpdateMetadata({
    expiresAtMs: NOW + 60_000,
    facts,
    fetchedAtMs: NOW,
    targetVersion,
  })
  return createCache({ expiresAtMs: metadata.expiresAtMs, kind: 'hit', value: metadata })
}

function createCache(lookup: CacheLookup): CachePort {
  return {
    read: async request => {
      expect(request.key).toBe(getSelfUpdateMetadataCacheKey(facts))
      return { kind: 'success', value: lookup }
    },
    remove: async () => {
      throw new Error('passive notice must not remove cache entries')
    },
    write: async () => {
      throw new Error('passive notice must not write cache entries')
    },
  }
}
