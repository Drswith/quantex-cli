import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  createSession: vi.fn(),
  dispose: vi.fn(),
  execute: vi.fn(),
  resolveObservation: vi.fn(),
  resolveUnmanaged: vi.fn(),
  getAgent: vi.fn(),
}))

vi.mock('../../src/commands/core-installation-cli', () => ({
  createCoreInstallationCliSession: control.createSession,
}))

vi.mock('../../src/commands/unmanaged-install-compatibility', () => ({
  resolveUnmanagedExternalAgent: control.resolveUnmanaged,
}))

vi.mock('../../src/services/agents', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/agents')>()
  return { ...actual, resolveAgent: (name: string) => control.getAgent(name) }
})

vi.mock('../../src/services/lifecycle-observations', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/lifecycle-observations')>()
  return { ...actual, resolveAgentObservation: control.resolveObservation }
})

import { resetCliContext, setCliContext } from '../../src/cli-context'
import { installCommand } from '../../src/commands/install'
import { createErrorResult, createSuccessResult } from '../../src/output'

const testAgent = {
  binaryName: 'test-bin',
  displayName: 'Test Agent',
  homepage: 'https://example.com',
  name: 'test-agent',
  packages: { npm: 'test-pkg' },
  platforms: { linux: [{ type: 'bun' as const }] },
}

describe('installCommand', () => {
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
    control.resolveObservation.mockReset()
    control.getAgent.mockReset()
    control.resolveUnmanaged.mockResolvedValue(undefined)
    control.getAgent.mockImplementation((name: string) => (name === 'test-agent' ? testAgent : undefined))
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
        action: 'install',
        error: { code: 'AGENT_NOT_FOUND', details: { input: 'unknown' }, message: 'Unknown agent: unknown' },
        target: { kind: 'agent', name: 'unknown' },
      }),
    )

    await installCommand('unknown')

    expect(control.createSession).toHaveBeenCalledWith('install')
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'))
    expect(control.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps already-installed Core warnings on the maintained presentation path', async () => {
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'install',
        data: { agent: { displayName: 'Test Agent', name: 'test-agent' }, changed: false, installed: true },
        target: { kind: 'agent', name: 'test-agent' },
        warnings: [{ code: 'ALREADY_INSTALLED', message: 'Test Agent is already installed.' }],
      }),
    )

    await installCommand('test-agent')

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
  })

  it('returns a dry-run plan from the retained planning route without Core mutation', async () => {
    setCliContext({
      dryRun: true,
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })
    control.resolveObservation.mockResolvedValueOnce({
      agent: testAgent,
      methods: [{ type: 'bun' }],
      observation: {
        drift: { kind: 'none' },
        kind: 'absent',
        observedAt: '2026-01-01T00:00:00.000Z',
        targetId: 'test-agent',
      },
      pathExecutable: { present: false },
    })

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.data?.changed).toBe(false)
    expect(result.warnings[0]?.code).toBe('DRY_RUN')
    expect(result.warnings[0]?.message).toBe('Dry run: would install Test Agent.')
    expect(control.createSession).not.toHaveBeenCalled()
  })

  it('ignores the retired legacy env override and still uses Core for apply', async () => {
    process.env.QUANTEX_INSTALLATION_ENGINE = 'legacy'
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'install',
        data: {
          agent: { displayName: 'Test Agent', name: 'test-agent' },
          changed: true,
          installState: { installType: 'bun', packageName: 'test-pkg' },
          installed: true,
        },
        target: { kind: 'agent', name: 'test-agent' },
      }),
    )

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(control.createSession).toHaveBeenCalledWith('install')
    expect(control.execute).toHaveBeenCalledWith('test-agent', { emitStartedEvent: true })
  })

  it('emits a structured result in json mode without engine fields', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'test-run-id',
    })
    control.execute.mockResolvedValueOnce(
      createSuccessResult({
        action: 'install',
        data: {
          agent: { displayName: 'Test Agent', name: 'test-agent' },
          changed: true,
          installState: { installType: 'bun', packageName: 'test-pkg' },
          installed: true,
        },
        target: { kind: 'agent', name: 'test-agent' },
      }),
    )

    await installCommand('test-agent')

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.action).toBe('install')
    expect(payload).toMatchObject({
      data: { agent: { name: 'test-agent' }, changed: true },
      meta: { runId: 'test-run-id', schemaVersion: '1' },
    })
    expect(JSON.stringify(payload)).not.toMatch(/"(?:engine|route)"/)
  })

  it('preserves unmanaged external installs before Core execution', async () => {
    control.resolveUnmanaged.mockResolvedValueOnce({
      displayName: 'Test Agent',
      name: 'test-agent',
    })

    const result = await installCommand('test-agent')

    expect(result.ok).toBe(true)
    expect(result.warnings[0]?.code).toBe('UNTRACKED_EXISTING_INSTALL')
    expect(control.createSession).toHaveBeenCalledWith('install')
    expect(control.execute).not.toHaveBeenCalled()
  })
})
