import type { InstallationEngineRoute } from '../../src/commands/installation-routing'
import type { CommandResult } from '../../src/output/types'
import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  createSession: vi.fn(),
  dispose: vi.fn(),
  execute: vi.fn(),
  legacyLock: vi.fn(),
}))

vi.mock('../../src/commands/core-installation-cli', () => ({
  createCoreInstallationCliSession: control.createSession,
}))

vi.mock('../../src/package-manager', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/package-manager')>()
  return { ...actual, withAgentLifecycleLock: control.legacyLock }
})

import { setCliContext } from '../../src/cli-context'
import { ensureCommandWithRoute } from '../../src/commands/ensure'
import { installCommandWithRoute } from '../../src/commands/install'
import {
  createCoreInstallationTestRoute,
  reportInstallationEngineRoute,
  selectInstallationEngineRoute,
} from '../../src/commands/installation-routing'
import { createErrorResult, createSuccessResult } from '../../src/output'

beforeEach(() => {
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
  control.legacyLock.mockReset()
  control.legacyLock.mockImplementation(async run => await run())
  control.createSession.mockImplementation(() => ({
    dispose: control.dispose,
    execute: control.execute,
  }))
  control.execute.mockImplementation(async (name: string) => installSuccess(name))
})

describe('installation engine routing', () => {
  it('keeps the production selector frozen on legacy for install and ensure', () => {
    const install = selectInstallationEngineRoute('install')
    const ensure = selectInstallationEngineRoute('ensure')

    expect(install).toEqual({ engine: 'legacy', source: 'stable-default' })
    expect(ensure).toBe(install)
    expect(Object.isFrozen(install)).toBe(true)
  })

  it('selects the Core batch route once and reuses one session for every target', async () => {
    let routeReads = 0
    const route = Object.freeze({
      adoption: 'v1-safe' as const,
      get engine() {
        routeReads += 1
        return 'core' as const
      },
      source: 'test' as const,
    }) as InstallationEngineRoute

    const result = await installCommandWithRoute(['first', 'second', 'first'], route)

    expect(result.ok).toBe(true)
    expect(routeReads).toBe(1)
    expect(control.createSession).toHaveBeenCalledTimes(1)
    expect(control.createSession).toHaveBeenCalledWith('install')
    expect(control.execute.mock.calls.map(call => call[0])).toEqual(['first', 'second'])
    expect(control.execute.mock.calls.map(call => call[1])).toEqual([{}, {}])
    expect(control.dispose).toHaveBeenCalledTimes(1)
    expect(control.legacyLock).not.toHaveBeenCalled()
  })

  it('contains Core failures in the selected engine and continues an ordinary batch failure', async () => {
    control.execute
      .mockResolvedValueOnce(installFailure('first', 'INSTALL_FAILED'))
      .mockResolvedValueOnce(installSuccess('second'))

    const result = await installCommandWithRoute(['first', 'second'], createCoreInstallationTestRoute())

    expect(result.error?.code).toBe('INSTALL_FAILED')
    expect(control.execute).toHaveBeenCalledTimes(2)
    expect(control.legacyLock).not.toHaveBeenCalled()
  })

  it('keeps v1 batch continuation for a provider-originated Core cancellation', async () => {
    control.execute
      .mockResolvedValueOnce(installFailure('first', 'CANCELLED'))
      .mockResolvedValueOnce(installSuccess('second'))

    const result = await installCommandWithRoute(['first', 'second'], createCoreInstallationTestRoute())

    expect(result.error?.code).toBe('INSTALL_FAILED')
    expect(control.execute).toHaveBeenCalledTimes(2)
    expect(control.legacyLock).not.toHaveBeenCalled()
  })

  it('branches ensure to Core before the legacy lifecycle lock and requests a started hook', async () => {
    control.execute.mockResolvedValueOnce(ensureSuccess('fixture'))

    const result = await ensureCommandWithRoute('fixture', createCoreInstallationTestRoute())

    expect(result.ok).toBe(true)
    expect(control.createSession).toHaveBeenCalledWith('ensure')
    expect(control.execute).toHaveBeenCalledWith('fixture', { emitStartedEvent: true })
    expect(control.dispose).toHaveBeenCalledTimes(1)
    expect(control.legacyLock).not.toHaveBeenCalled()
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
