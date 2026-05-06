import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import * as selfModule from '../src/self'
import { maybeRenderSelfUpdateNotice } from '../src/self/update-notice'
import * as state from '../src/state'

const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelf')
const getSelfStateSpy = vi.spyOn(state, 'getSelfState')
const setSelfUpdateNoticeStateSpy = vi.spyOn(state, 'setSelfUpdateNoticeState')

describe('maybeRenderSelfUpdateNotice', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    inspectSelfSpy.mockClear()
    getSelfStateSpy.mockClear()
    setSelfUpdateNoticeStateSpy.mockClear()
    getSelfStateSpy.mockResolvedValue({})
    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'notice-run-id',
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('suppresses passive notices when latest version is lower than current', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '0.15.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '0.14.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await maybeRenderSelfUpdateNotice({ action: 'list', ok: true })

    expect(logSpy).not.toHaveBeenCalled()
    expect(setSelfUpdateNoticeStateSpy).not.toHaveBeenCalled()
  })
})
