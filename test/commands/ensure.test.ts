import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  createSession: vi.fn(),
  dispose: vi.fn(),
  execute: vi.fn(),
  resolveUnmanaged: vi.fn(),
}))

vi.mock('../../src/commands/core-installation-cli', () => ({
  createCoreInstallationCliSession: control.createSession,
}))

vi.mock('../../src/commands/unmanaged-install-compatibility', () => ({
  resolveUnmanagedExternalAgent: control.resolveUnmanaged,
}))

import { resetCliContext, setCliContext } from '../../src/cli-context'
import { ensureCommand } from '../../src/commands/ensure'
import { createErrorResult, createSuccessResult } from '../../src/output'

describe('ensureCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    delete process.env.QUANTEX_INSTALLATION_ENGINE
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    control.createSession.mockReset()
    control.dispose.mockReset()
    control.execute.mockReset()
    control.resolveUnmanaged.mockReset()
    control.resolveUnmanaged.mockResolvedValue(undefined)
    control.createSession.mockImplementation(() => ({
      dispose: control.dispose,
      execute: control.execute,
    }))
  })

  afterEach(() => {
    delete process.env.QUANTEX_INSTALLATION_ENGINE
    resetCliContext()
    logSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  it('routes unknown agents through Core and surfaces AGENT_NOT_FOUND', async () => {
    control.execute.mockResolvedValueOnce(
      createErrorResult({
        action: 'ensure',
        error: { code: 'AGENT_NOT_FOUND', details: { input: 'unknown' }, message: 'Unknown agent: unknown' },
        target: { kind: 'agent', name: 'unknown' },
      }),
    )

    await ensureCommand('unknown')

    expect(control.createSession).toHaveBeenCalledWith('ensure')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
  })

  it('returns already installed without reinstalling when Core reports satisfied', async () => {
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'ensure',
        data: { agent: { displayName: 'Test Agent', name: 'test-agent' }, changed: false, installed: true },
        target: { kind: 'agent', name: 'test-agent' },
        warnings: [{ code: 'ALREADY_INSTALLED', message: 'Test Agent is already installed.' }],
      }),
    )

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data?.changed).toBe(false)
    expect(result.warnings[0]?.code).toBe('ALREADY_INSTALLED')
    expect(control.execute).toHaveBeenCalledWith('test-agent', { emitStartedEvent: true })
  })

  it('keeps dry-run on Core preview with the maintained DRY_RUN warning', async () => {
    setCliContext({ dryRun: true, interactive: false, outputMode: 'json', runId: 'ensure-dry-run' })
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'ensure',
        data: { agent: { displayName: 'Test Agent', name: 'test-agent' }, changed: false, installed: false },
        target: { kind: 'agent', name: 'test-agent' },
        warnings: [{ code: 'DRY_RUN', message: 'Dry run: would install Test Agent.' }],
      }),
    )

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.warnings[0]?.code).toBe('DRY_RUN')
    expect(result.warnings[0]?.message).toBe('Dry run: would install Test Agent.')
  })

  it('keeps tracked-ghost dry-run conditional messaging from Core preview', async () => {
    setCliContext({ dryRun: true, interactive: false, outputMode: 'json', runId: 'ghost-dry-run' })
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'ensure',
        data: { agent: { displayName: 'Test Agent', name: 'test-agent' }, changed: false, installed: false },
        target: { kind: 'agent', name: 'test-agent' },
        warnings: [
          {
            code: 'DRY_RUN',
            message: 'Dry run: would reinstall Test Agent only if its recorded provider target is confirmed absent.',
          },
        ],
      }),
    )

    const result = await ensureCommand('test-agent')

    expect(result.warnings[0]?.message).toContain('would reinstall Test Agent only if')
  })

  it('ignores the retired legacy env override and still uses Core', async () => {
    process.env.QUANTEX_INSTALLATION_ENGINE = 'legacy'
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'ensure',
        data: {
          agent: { displayName: 'Test Agent', name: 'test-agent' },
          changed: true,
          installState: { installType: 'bun', packageName: 'test-pkg' },
          installed: true,
        },
        target: { kind: 'agent', name: 'test-agent' },
      }),
    )

    const result = await ensureCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(control.createSession).toHaveBeenCalledWith('ensure')
  })

  it('emits structured output in json mode without engine fields', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'ensure-json' })
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'ensure',
        data: {
          agent: { displayName: 'Test Agent', name: 'test-agent' },
          changed: true,
          installState: { installType: 'bun', packageName: 'test-pkg' },
          installed: true,
        },
        target: { kind: 'agent', name: 'test-agent' },
      }),
    )

    await ensureCommand('test-agent')

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>
    expect(payload).toMatchObject({ action: 'ensure', ok: true, target: { kind: 'agent', name: 'test-agent' } })
    expect(JSON.stringify(payload)).not.toMatch(/"(?:engine|route)"/)
  })
})
