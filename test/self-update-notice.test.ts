import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCliContext } from '../src/cli-context'
import * as selfModule from '../src/self'
import { maybeRenderSelfUpdateNotice } from '../src/self/update-notice'
import * as state from '../src/state'

const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelfReadOnly')
const getSelfStateSpy = vi.spyOn(state, 'getSelfState')
const setSelfUpdateNoticeStateSpy = vi.spyOn(state, 'setSelfUpdateNoticeState')

describe('maybeRenderSelfUpdateNotice', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    inspectSelfSpy.mockClear()
    getSelfStateSpy.mockClear()
    setSelfUpdateNoticeStateSpy.mockClear()
    getSelfStateSpy.mockResolvedValue({})
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

    expect(stdoutWriteSpy).not.toHaveBeenCalled()
    expect(setSelfUpdateNoticeStateSpy).not.toHaveBeenCalled()
  })

  it('renders the exact latest-version notice without persisting notice state', async () => {
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '0.15.0',
      executablePath: '/Users/test/.bun/bin/qtx',
      installSource: 'bun',
      latestVersion: '0.16.0',
      packageRoot: '/Users/test/.bun/install/global/node_modules/quantex-cli',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    await maybeRenderSelfUpdateNotice({ action: 'list', ok: true })

    expect(stdoutWriteSpy).toHaveBeenCalledOnce()
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      'Quantex CLI 0.16.0 is available (current 0.15.0). Run `quantex upgrade`.\n',
    )
    expect(setSelfUpdateNoticeStateSpy).not.toHaveBeenCalled()
  })
})
