import type {
  InstallationEngineRoute,
  InstallationOperation,
  LifecycleEngineOperation,
} from '../../src/commands/installation-routing'
import type { CommandResult } from '../../src/output/types'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  createSession: vi.fn(),
  dispose: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('../../src/commands/core-installation-cli', () => ({
  createCoreInstallationCliSession: control.createSession,
}))

import { setCliContext } from '../../src/cli-context'
import { ensureCommandWithRoute } from '../../src/commands/ensure'
import { installCommandWithRoute } from '../../src/commands/install'
import {
  createCoreInstallationTestRoute,
  reportInstallationEngineRoute,
  selectInstallationEngineRoute,
} from '../../src/commands/installation-routing'
import { getExitCodeForResult } from '../../src/errors'
import { createErrorResult, createSuccessResult, emitCommandEvent } from '../../src/output'

beforeEach(() => {
  delete process.env.QUANTEX_INSTALLATION_ENGINE
  setCliContext({
    cancelled: false,
    colorMode: 'never',
    interactive: false,
    logLevel: 'silent',
    outputMode: 'human',
    quiet: true,
    runId: 'installation-routing-test',
  })
  control.createSession.mockReset()
  control.dispose.mockReset()
  control.execute.mockReset()
  control.createSession.mockImplementation(() => ({
    dispose: control.dispose,
    execute: control.execute,
  }))
  control.execute.mockImplementation(async (name: string) => installSuccess(name))
})

afterEach(() => {
  delete process.env.QUANTEX_INSTALLATION_ENGINE
})

describe('installation engine routing', () => {
  it('keeps the promoted operation set covering install, ensure, update, and uninstall', () => {
    expectTypeOf<LifecycleEngineOperation>().toEqualTypeOf<'ensure' | 'install' | 'uninstall' | 'update'>()
    expectTypeOf<InstallationOperation>().toEqualTypeOf<'ensure' | 'install'>()
  })

  it('selects the frozen Core stable-default route for install and ensure', () => {
    const install = selectInstallationEngineRoute('install')
    const ensure = selectInstallationEngineRoute('ensure')

    expect(install).toEqual({ adoption: 'v1-safe', engine: 'core', source: 'stable-default' })
    expect(ensure).toBe(install)
    expect(Object.isFrozen(install)).toBe(true)
  })

  it('selects Core for update and uninstall', () => {
    expect(selectInstallationEngineRoute('update')).toEqual({
      adoption: 'v1-safe',
      engine: 'core',
      source: 'stable-default',
    })
    expect(selectInstallationEngineRoute('uninstall')).toEqual({
      adoption: 'v1-safe',
      engine: 'core',
      source: 'stable-default',
    })
  })

  it('ignores QUANTEX_INSTALLATION_ENGINE=legacy for install and ensure', () => {
    process.env.QUANTEX_INSTALLATION_ENGINE = 'legacy'

    const install = selectInstallationEngineRoute('install')
    const ensure = selectInstallationEngineRoute('ensure')

    expect(install).toEqual({ adoption: 'v1-safe', engine: 'core', source: 'stable-default' })
    expect(ensure).toBe(install)
  })

  it('ignores non-exact and empty installation engine overrides', () => {
    process.env.QUANTEX_INSTALLATION_ENGINE = 'Legacy'
    expect(selectInstallationEngineRoute('install')).toEqual({
      adoption: 'v1-safe',
      engine: 'core',
      source: 'stable-default',
    })

    process.env.QUANTEX_INSTALLATION_ENGINE = 'core'
    expect(selectInstallationEngineRoute('ensure')).toEqual({
      adoption: 'v1-safe',
      engine: 'core',
      source: 'stable-default',
    })
  })

  it('keeps install and ensure dry-run on the maintained planning route', () => {
    setCliContext({
      cancelled: false,
      colorMode: 'never',
      dryRun: true,
      interactive: false,
      logLevel: 'silent',
      outputMode: 'json',
      quiet: true,
      runId: 'installation-routing-dry-run',
    })

    expect(selectInstallationEngineRoute('install')).toEqual({
      engine: 'dry-run-planning',
      source: 'dry-run-compatibility',
    })
    expect(selectInstallationEngineRoute('ensure')).toEqual({
      engine: 'dry-run-planning',
      source: 'dry-run-compatibility',
    })
  })

  it('still uses dry-run planning when the retired legacy env value is present', () => {
    process.env.QUANTEX_INSTALLATION_ENGINE = 'legacy'
    setCliContext({
      cancelled: false,
      colorMode: 'never',
      dryRun: true,
      interactive: false,
      logLevel: 'silent',
      outputMode: 'json',
      quiet: true,
      runId: 'installation-routing-dry-run-override',
    })

    expect(selectInstallationEngineRoute('install')).toEqual({
      engine: 'dry-run-planning',
      source: 'dry-run-compatibility',
    })
  })

  it('selects the Core batch route once and reuses one session for every target', async () => {
    const route = createCoreInstallationTestRoute()

    const result = await installCommandWithRoute(['first', 'second', 'first'], route)

    expect(result.ok).toBe(true)
    expect(control.createSession).toHaveBeenCalledTimes(1)
    expect(control.createSession).toHaveBeenCalledWith('install')
    expect(control.execute.mock.calls.map(call => call[0])).toEqual(['first', 'second'])
    expect(control.execute.mock.calls.map(call => call[1])).toEqual([{}, {}])
    expect(control.dispose).toHaveBeenCalledTimes(1)
  })

  it('contains Core failures in the selected engine and continues an ordinary batch failure', async () => {
    control.execute
      .mockResolvedValueOnce(installFailure('first', 'INSTALL_FAILED'))
      .mockResolvedValueOnce(installSuccess('second'))

    const result = await installCommandWithRoute(['first', 'second'], createCoreInstallationTestRoute())

    expect(result.error?.code).toBe('INSTALL_FAILED')
    expect(control.execute).toHaveBeenCalledTimes(2)
  })

  it('keeps v1 batch continuation for a provider-originated Core cancellation', async () => {
    control.execute
      .mockResolvedValueOnce(installFailure('first', 'CANCELLED'))
      .mockResolvedValueOnce(installSuccess('second'))

    const result = await installCommandWithRoute(['first', 'second'], createCoreInstallationTestRoute())

    expect(result.error?.code).toBe('INSTALL_FAILED')
    expect(control.execute).toHaveBeenCalledTimes(2)
  })

  it('branches ensure to Core and requests a started hook', async () => {
    control.execute.mockResolvedValueOnce(ensureSuccess('fixture'))

    const result = await ensureCommandWithRoute('fixture', createCoreInstallationTestRoute())

    expect(result.ok).toBe(true)
    expect(control.createSession).toHaveBeenCalledWith('ensure')
    expect(control.execute).toHaveBeenCalledWith('fixture', { emitStartedEvent: true })
    expect(control.dispose).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['install', 'human'],
    ['install', 'json'],
    ['install', 'ndjson'],
    ['ensure', 'human'],
    ['ensure', 'json'],
    ['ensure', 'ndjson'],
  ] as const)('keeps the %s Core route on the maintained v1 %s presentation path', async (operation, outputMode) => {
    setCliContext({
      cancelled: false,
      colorMode: 'never',
      interactive: false,
      logLevel: outputMode === 'human' ? 'info' : 'silent',
      outputMode,
      quiet: false,
      runId: `core-${operation}-${outputMode}`,
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    control.execute.mockImplementation(async (name: string, options?: { emitStartedEvent?: boolean }) => {
      const canonicalName = name === 'cmd' ? 'commandcode' : name
      if (options?.emitStartedEvent) {
        emitCommandEvent({
          action: operation,
          data: { agent: { displayName: canonicalName, name: canonicalName } },
          target: { kind: 'agent', name: canonicalName },
          type: 'started',
        })
      }
      return operation === 'install' ? installSuccess(canonicalName) : ensureSuccess(canonicalName)
    })

    try {
      const result =
        operation === 'install'
          ? await installCommandWithRoute('cmd', createCoreInstallationTestRoute())
          : await ensureCommandWithRoute('cmd', createCoreInstallationTestRoute())

      expect(result.action).toBe(operation)
      expect(result.target).toEqual({ kind: 'agent', name: 'commandcode' })
      expect(getExitCodeForResult(result)).toBe(0)

      if (outputMode === 'human') {
        const rendered = stdout.mock.calls.map(call => String(call[0])).join('')
        expect(rendered).toContain('Installing commandcode...')
        expect(rendered).toContain(
          operation === 'install' ? 'commandcode installed successfully!' : 'commandcode is now installed.',
        )
        expect(log).not.toHaveBeenCalled()
      } else if (outputMode === 'json') {
        expect(log).toHaveBeenCalledTimes(1)
        const payload = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>
        expect(payload).toMatchObject({ action: operation, ok: true, target: { kind: 'agent', name: 'commandcode' } })
        expect(JSON.stringify(payload)).not.toMatch(/"(?:engine|route)"/)
      } else {
        expect(log).toHaveBeenCalledTimes(2)
        const events = log.mock.calls.map(call => JSON.parse(String(call[0])) as Record<string, unknown>)
        expect(events.map(event => event.type)).toEqual(['started', 'result'])
        expect(events[0]).toMatchObject({ action: operation, target: { kind: 'agent', name: 'commandcode' } })
        expect(events[1]).toMatchObject({ action: operation, data: { ok: true } })
        expect(JSON.stringify(events)).not.toMatch(/"(?:engine|route)"/)
      }
    } finally {
      log.mockRestore()
      stdout.mockRestore()
    }
  })

  it('writes route diagnostics only to debug stderr', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    reportInstallationEngineRoute('install', createCoreInstallationTestRoute())
    expect(stderr).not.toHaveBeenCalled()

    setCliContext({
      cancelled: false,
      colorMode: 'never',
      interactive: false,
      logLevel: 'debug',
      outputMode: 'json',
      quiet: true,
      runId: 'route-debug',
    })
    reportInstallationEngineRoute('install', createCoreInstallationTestRoute())

    expect(stderr).toHaveBeenCalledOnce()
    expect(String(stderr.mock.calls[0]?.[0])).toContain('install engine=core source=test')

    reportInstallationEngineRoute('ensure', selectInstallationEngineRoute('ensure'))
    expect(String(stderr.mock.calls[1]?.[0])).toContain('ensure engine=core source=stable-default')
    stderr.mockRestore()
  })
})

function installSuccess(name: string): CommandResult {
  return createSuccessResult({
    action: 'install',
    data: {
      agent: { displayName: name, name },
      changed: true,
      installed: true,
    },
    target: { kind: 'agent', name },
  })
}

function ensureSuccess(name: string): CommandResult {
  return createSuccessResult({
    action: 'ensure',
    data: {
      agent: { displayName: name, name },
      changed: true,
      installed: true,
    },
    target: { kind: 'agent', name },
  })
}

function installFailure(name: string, code: 'CANCELLED' | 'INSTALL_FAILED'): CommandResult {
  return createErrorResult({
    action: 'install',
    data: {
      agent: { displayName: name, name },
      changed: false,
      installed: false,
    },
    error: { code, message: `${name} failed` },
    target: { kind: 'agent', name },
  })
}
