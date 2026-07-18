import type { ProcessPort, RuntimeOutcome } from '../../src/runtime'
import type { SelfUpgradePlan } from '../../src/self'
import { describe, expect, it, vi } from 'vitest'
import { verifySelfUpgradeResult } from '../../src/self/planning'
import { bunSelfUpgradeProvider } from '../../src/self/providers/bun'
import { npmSelfUpgradeProvider } from '../../src/self/providers/npm'
import { ProcessInterruptionError } from '../../src/utils/child-process'

describe('managed self-upgrade process ports', () => {
  it('runs the exact npm global install argv through ProcessPort', async () => {
    const run = vi.fn(async () => success({ exitCode: 0 }))
    const processPort: ProcessPort = { run }
    const plan = createPlan('npm')

    await expect(
      npmSelfUpgradeProvider.upgrade(plan, {
        process: processPort,
        signal: new AbortController().signal,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeoutMs: 2_000,
      }),
    ).resolves.toMatchObject({ installSource: 'npm', newVersion: '1.1.0', success: true })
    expect(run).toHaveBeenCalledWith({
      argv: ['npm', 'install', '-g', 'quantex-cli@beta', '--registry', 'https://registry.example'],
      forwardPipedOutput: true,
      signal: expect.any(AbortSignal),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeoutMs: 2_000,
    })
  })

  it('preserves Bun global trust checks after a successful install', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(success({ exitCode: 0 }))
      .mockResolvedValueOnce(
        success({ exitCode: 0, stdout: new TextEncoder().encode('./node_modules/quantex-cli @0.29.0\n') }),
      )
      .mockResolvedValueOnce(success({ exitCode: 0 }))

    await expect(
      bunSelfUpgradeProvider.upgrade(createPlan('bun'), {
        process: { run },
        signal: new AbortController().signal,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeoutMs: 2_000,
      }),
    ).resolves.toMatchObject({ installSource: 'bun', newVersion: '1.1.0', success: true })
    expect(run.mock.calls.map(([request]) => request)).toEqual([
      {
        argv: ['bun', 'add', '-g', '--registry', 'https://registry.example', 'quantex-cli@beta'],
        forwardPipedOutput: true,
        signal: expect.any(AbortSignal),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeoutMs: 2_000,
      },
      {
        argv: ['bun', 'pm', '-g', 'untrusted'],
        forwardPipedOutput: false,
        signal: expect.any(AbortSignal),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeoutMs: 2_000,
      },
      {
        argv: ['bun', 'pm', '-g', 'trust', 'quantex-cli'],
        forwardPipedOutput: true,
        signal: expect.any(AbortSignal),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeoutMs: 2_000,
      },
    ])
  })

  it('preserves the Bun global Quantex package when trust fails after add', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(success({ exitCode: 0 }))
      .mockResolvedValueOnce(
        success({ exitCode: 0, stdout: new TextEncoder().encode('./node_modules/quantex-cli @0.29.0\n') }),
      )
      .mockResolvedValueOnce(success({ exitCode: 1 }))

    await expect(
      bunSelfUpgradeProvider.upgrade(createPlan('bun'), {
        process: { run },
        signal: new AbortController().signal,
        stdio: ['inherit', 'inherit', 'inherit'],
      }),
    ).resolves.toMatchObject({ installSource: 'bun', success: false })
    expect(run.mock.calls.map(([request]) => request.argv)).toEqual([
      ['bun', 'add', '-g', '--registry', 'https://registry.example', 'quantex-cli@beta'],
      ['bun', 'pm', '-g', 'untrusted'],
      ['bun', 'pm', '-g', 'trust', 'quantex-cli'],
    ])
    expect(run.mock.calls.some(([request]) => request.argv[1] === 'remove')).toBe(false)
  })

  it('preserves the Bun global Quantex package when untrusted probe fails after add', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(success({ exitCode: 0 }))
      .mockResolvedValueOnce(success({ exitCode: 1 }))

    await expect(
      bunSelfUpgradeProvider.upgrade(createPlan('bun'), {
        process: { run },
        signal: new AbortController().signal,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).resolves.toMatchObject({ installSource: 'bun', success: false })
    expect(run.mock.calls.map(([request]) => request.argv)).toEqual([
      ['bun', 'add', '-g', '--registry', 'https://registry.example', 'quantex-cli@beta'],
      ['bun', 'pm', '-g', 'untrusted'],
    ])
    expect(run.mock.calls.some(([request]) => request.argv[1] === 'remove')).toBe(false)
  })

  it('maps a non-zero managed install exit to the existing provider failure', async () => {
    const processPort: ProcessPort = { run: async () => success({ exitCode: 9 }) }

    await expect(
      npmSelfUpgradeProvider.upgrade(createPlan('npm'), {
        process: processPort,
        signal: new AbortController().signal,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).resolves.toMatchObject({ error: { kind: 'unknown' }, installSource: 'npm', success: false })
  })

  it('preserves cancellation as a process interruption', async () => {
    const processPort: ProcessPort = {
      run: async () => ({
        error: { kind: 'cancelled', message: 'cancelled install' },
        kind: 'failure',
      }),
    }

    await expect(
      bunSelfUpgradeProvider.upgrade(createPlan('bun'), {
        process: processPort,
        signal: new AbortController().signal,
        stdio: ['inherit', 'inherit', 'inherit'],
      }),
    ).rejects.toMatchObject({ kind: 'cancelled' })
  })

  it('verifies the managed entry point then falls back to the executable through ProcessPort', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(success({ exitCode: 1, stdout: new Uint8Array() }))
      .mockResolvedValueOnce(success({ exitCode: 0, stdout: new TextEncoder().encode('quantex 1.1.0\n') }))
    const plan = createPlan('npm')

    await expect(
      verifySelfUpgradeResult(
        plan,
        { installSource: 'npm', newVersion: '1.1.0', success: true },
        { process: { run }, signal: new AbortController().signal, timeoutMs: 3_000 },
      ),
    ).resolves.toMatchObject({ newVersion: '1.1.0', success: true })
    expect(run.mock.calls.map(([request]) => request.argv)).toEqual([
      [process.execPath, '/tmp/quantex-cli/dist/cli.mjs', '--version'],
      ['/tmp/qtx', '--version'],
    ])
  })

  it('translates a timed-out verification into the existing interruption error', async () => {
    const processPort: ProcessPort = {
      run: async () => ({ error: { kind: 'timed-out', message: 'timed out' }, kind: 'failure' }),
    }

    await expect(
      verifySelfUpgradeResult(
        createPlan('npm'),
        { installSource: 'npm', success: true },
        { process: processPort, signal: new AbortController().signal, timeoutMs: 500 },
      ),
    ).rejects.toBeInstanceOf(ProcessInterruptionError)
  })
})

function createPlan(installSource: 'bun' | 'npm'): SelfUpgradePlan {
  return {
    facts: {
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/qtx',
      installSource,
      packageRoot: '/tmp/quantex-cli',
      updateChannel: 'beta',
    },
    status: 'update-available',
    target: {
      managedRegistry: 'https://registry.example',
      packageTag: 'beta',
      targetVersion: '1.1.0',
      verificationCommand: [process.execPath, '/tmp/quantex-cli/dist/cli.mjs', '--version'],
    },
    updateAvailable: true,
  }
}

function success<T>(value: T): RuntimeOutcome<T> {
  return { kind: 'success', value }
}
