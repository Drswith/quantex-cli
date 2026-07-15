import type {
  IdempotencyPostcondition,
  IdempotencyReceiptEvidence,
  IdempotencyReceiptSnapshot,
} from '../src/idempotency/schema'
import type { LifecycleProviderBinding } from '../src/lifecycle'
import type { CommandResult } from '../src/output/types'
import type { ResolvedAgentObservation } from '../src/services/lifecycle-observations'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerCliCancellationHandler, setCliContext } from '../src/cli-context'
import { executeCommandWithRuntime } from '../src/command-runtime'
import {
  getIdempotencyDir,
  getIdempotencyFilePath,
  loadIdempotencyRecord,
  loadVersionedIdempotencyRecord,
  saveIdempotencyRecord,
  saveVersionedIdempotencyRecord,
  type VersionedIdempotencyRecordInput,
} from '../src/idempotency'
import { canonicalizeMutationRequest, fingerprintCanonicalValue } from '../src/idempotency/canonical'
import { createAgentAbsenceIdempotencyPolicy } from '../src/idempotency/lifecycle-policy'
import { canonicalizeAllOfPostcondition, canonicalizeReceiptSet } from '../src/idempotency/schema'
import { createErrorResult, createSuccessResult, emitCommandResult } from '../src/output'
import { firstPartyProviderRegistry } from '../src/providers'
import * as selfModule from '../src/self'
import * as updateNotice from '../src/self/update-notice'

const inspectSelfSpy = vi.spyOn(selfModule, 'inspectSelf')

describe('executeCommandWithRuntime', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let tempHome: string
  const originalHome = process.env.HOME

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    tempHome = mkdtempSync(join(tmpdir(), 'quantex-runtime-'))
    process.env.HOME = tempHome
  })

  afterEach(() => {
    logSpy.mockRestore()
    inspectSelfSpy.mockReset()
    vi.useRealTimers()
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    rmSync(tempHome, { force: true, recursive: true })
  })

  it('returns a timeout error when execution exceeds the configured deadline', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'timeout-run-id',
      timeoutMs: 1,
    })

    const result = await executeCommandWithRuntime({
      action: 'install',
      run: () => new Promise<CommandResult<unknown>>(() => {}),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    const cancelledEvent = JSON.parse(logSpy.mock.calls[0][0])
    const resultEvent = JSON.parse(logSpy.mock.calls[1][0])
    expect(cancelledEvent.type).toBe('cancelled')
    expect(cancelledEvent.data.reason).toBe('timeout')
    expect(resultEvent.type).toBe('result')
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('TIMEOUT')
  })

  it('passes through successful results before the timeout fires', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'timeout-run-id',
      timeoutMs: 1000,
    })

    const result = await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: {
            agents: [],
          },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(result.ok).toBe(true)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('does not treat passive post-run work as part of the command timeout budget', async () => {
    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'timeout-budget-id',
      timeoutMs: 50,
    })

    inspectSelfSpy.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => {
            resolve({
              canAutoUpdate: true,
              currentVersion: '1.0.0',
              executablePath: '/tmp/quantex',
              installSource: 'npm',
              latestVersion: '1.1.0',
              managedRegistry: undefined,
              managedRegistryIsOverride: undefined,
              packageRoot: '/tmp/quantex',
              recommendedUpgradeCommand: 'quantex upgrade',
              upstreamLatestVersion: '1.1.0',
              updateChannel: 'stable',
            })
          }, 200),
        ),
    )

    const result = await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: { agents: [] },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.error).toBeNull()
  })

  it('does not replay a stored result when the same idempotency key is reused for a different target agent', async () => {
    const run = vi.fn(async () =>
      createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'cursor',
        },
      }),
    )

    setCliContext({
      idempotencyKey: 'job-1',
      interactive: false,
      outputMode: 'json',
      runId: 'first-run-id',
    })

    await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    setCliContext({
      idempotencyKey: 'job-1',
      interactive: false,
      outputMode: 'json',
      runId: 'second-run-id',
    })

    const replayed = await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'cursor',
      },
    })

    expect(run).toHaveBeenCalledTimes(2)
    expect(replayed.ok).toBe(true)
    expect(replayed.target?.name).toBe('cursor')
  })

  it('returns success when the command completes successfully after the timeout deadline fires', async () => {
    vi.useFakeTimers()
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'late-success-run-id',
      timeoutMs: 20,
    })

    const execution = executeCommandWithRuntime({
      action: 'install',
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 30))
        return emitCommandResult(
          createSuccessResult({
            action: 'install',
            data: {
              installed: true,
            },
            target: {
              kind: 'agent',
              name: 'codex',
            },
          }),
          () => {},
        )
      },
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    await vi.advanceTimersByTimeAsync(20)
    await vi.advanceTimersByTimeAsync(10)

    const result = await execution

    expect(result.ok).toBe(true)
    expect(result.error).toBeNull()
    expect(logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('"code": "TIMEOUT"'))).toBe(false)
    expect(logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('"ok": true'))).toBe(true)
  })

  it('does not emit timeout output for ndjson when late success upgrades the result', async () => {
    vi.useFakeTimers()
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'late-success-ndjson-run-id',
      timeoutMs: 20,
    })

    const execution = executeCommandWithRuntime({
      action: 'install',
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 30))
        return emitCommandResult(
          createSuccessResult({
            action: 'install',
            data: {
              installed: true,
            },
            target: {
              kind: 'agent',
              name: 'codex',
            },
          }),
          () => {},
        )
      },
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    await vi.advanceTimersByTimeAsync(20)
    await vi.advanceTimersByTimeAsync(10)

    const result = await execution

    expect(result.ok).toBe(true)
    expect(logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('"type": "cancelled"'))).toBe(false)
    expect(logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('"code": "TIMEOUT"'))).toBe(false)
  })

  it('returns a concrete failure when the command fails after the timeout deadline fires', async () => {
    vi.useFakeTimers()
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'late-failure-run-id',
      timeoutMs: 20,
    })

    const execution = executeCommandWithRuntime({
      action: 'install',
      run: async () => {
        await new Promise(resolve => setTimeout(resolve, 30))
        return emitCommandResult(
          createErrorResult({
            action: 'install',
            error: {
              code: 'INSTALL_FAILED',
              message: 'Install failed.',
            },
            target: {
              kind: 'agent',
              name: 'codex',
            },
          }),
          () => {},
        )
      },
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    await vi.advanceTimersByTimeAsync(20)
    await vi.advanceTimersByTimeAsync(10)

    const result = await execution

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INSTALL_FAILED')
    expect(logSpy.mock.calls.some((call: unknown[]) => String(call[0]).includes('"code": "TIMEOUT"'))).toBe(false)
  })

  it('does not replay a stored result for a different idempotency key that previously collided after sanitization', async () => {
    const run = vi.fn(async () =>
      createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'cursor',
        },
      }),
    )

    setCliContext({
      idempotencyKey: 'job-1/install/codex',
      interactive: false,
      outputMode: 'json',
      runId: 'first-run-id',
    })

    await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    setCliContext({
      idempotencyKey: 'job-1_install_codex',
      interactive: false,
      outputMode: 'json',
      runId: 'second-run-id',
    })

    const replayed = await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'cursor',
      },
    })

    expect(run).toHaveBeenCalledTimes(2)
    expect(replayed.ok).toBe(true)
    expect(replayed.target?.name).toBe('cursor')
  })

  it('does not persist dry-run results for an idempotency key', async () => {
    const run = vi.fn(async () =>
      createSuccessResult({
        action: 'install',
        data: {
          installed: false,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
        warnings: [
          {
            code: 'DRY_RUN',
            message: 'Dry run: would install Codex.',
          },
        ],
      }),
    )

    setCliContext({
      dryRun: true,
      idempotencyKey: 'dry-install',
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })

    await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(await loadIdempotencyRecord('dry-install')).toBeUndefined()
  })

  it('does not replay a dry-run result for a real retry with the same idempotency key', async () => {
    const dryRun = vi.fn(async () =>
      createSuccessResult({
        action: 'install',
        data: {
          installed: false,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
        warnings: [
          {
            code: 'DRY_RUN',
            message: 'Dry run: would install Codex.',
          },
        ],
      }),
    )

    setCliContext({
      dryRun: true,
      idempotencyKey: 'dry-then-real',
      interactive: false,
      outputMode: 'json',
      runId: 'dry-run-id',
    })

    await executeCommandWithRuntime({
      action: 'install',
      run: dryRun,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    const realRun = vi.fn(async () =>
      createSuccessResult({
        action: 'install',
        data: {
          installed: true,
        },
        target: {
          kind: 'agent',
          name: 'codex',
        },
      }),
    )

    setCliContext({
      idempotencyKey: 'dry-then-real',
      interactive: false,
      outputMode: 'json',
      runId: 'real-run-id',
    })

    const result = await executeCommandWithRuntime({
      action: 'install',
      run: realRun,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(realRun).toHaveBeenCalledTimes(1)
    expect(result.data).toEqual({ installed: true })
  })

  it('does not replay a stored batch install result for a different agent set', async () => {
    const run = vi.fn(async (agents: string) =>
      createSuccessResult({
        action: 'install',
        data: {
          scope: 'batch',
        },
        target: {
          kind: 'agent',
          name: agents,
        },
      }),
    )

    setCliContext({
      idempotencyKey: 'batch-install',
      interactive: false,
      outputMode: 'json',
      runId: 'first-batch-run-id',
    })

    await executeCommandWithRuntime({
      action: 'install',
      run: () => run('codex,cursor'),
      target: {
        kind: 'agent',
        name: 'codex,cursor',
      },
    })

    setCliContext({
      idempotencyKey: 'batch-install',
      interactive: false,
      outputMode: 'json',
      runId: 'second-batch-run-id',
    })

    const replayed = await executeCommandWithRuntime({
      action: 'install',
      run: () => run('vtcode'),
      target: {
        kind: 'agent',
        name: 'vtcode',
      },
    })

    expect(run).toHaveBeenCalledTimes(2)
    expect(replayed.target?.name).toBe('vtcode')
  })

  it('does not persist or replay transient timeout failures for an idempotency key', async () => {
    const run = vi
      .fn()
      .mockImplementationOnce(() => new Promise<CommandResult<unknown>>(() => {}))
      .mockResolvedValueOnce(
        createSuccessResult({
          action: 'install',
          data: {
            installed: true,
          },
          target: {
            kind: 'agent',
            name: 'codex',
          },
        }),
      )

    setCliContext({
      idempotencyKey: 'install-codex-retry',
      interactive: false,
      outputMode: 'json',
      runId: 'timeout-first-run-id',
      timeoutMs: 1,
    })

    const timedOut = await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(timedOut.ok).toBe(false)
    expect(timedOut.error?.code).toBe('TIMEOUT')
    expect(await loadIdempotencyRecord('install-codex-retry')).toBeUndefined()

    setCliContext({
      idempotencyKey: 'install-codex-retry',
      interactive: false,
      outputMode: 'json',
      runId: 'timeout-retry-run-id',
      timeoutMs: 1000,
    })

    const retried = await executeCommandWithRuntime({
      action: 'install',
      run,
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    expect(run).toHaveBeenCalledTimes(2)
    expect(retried.ok).toBe(true)
  })

  it('does not read or overwrite retained legacy evidence when a mutation has no versioned policy', async () => {
    const key = 'no-legacy-fallback'
    const run = vi.fn(async () => successfulUpdateResult())
    await saveIdempotencyRecord(key, {
      action: 'update',
      result: successfulUpdateResult(),
      target: agentTarget('codex'),
    })
    const path = getIdempotencyFilePath(key)
    const legacyBytes = readFileSync(path, 'utf8')
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: 'legacy-first' })

    await executeCommandWithRuntime({ action: 'update', run, target: agentTarget('codex') })
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: 'legacy-second' })
    await executeCommandWithRuntime({ action: 'update', run, target: agentTarget('codex') })

    expect(run).toHaveBeenCalledTimes(2)
    expect(readFileSync(path, 'utf8')).toBe(legacyBytes)
  })

  it('persists missing versioned evidence and replays it with fresh public metadata', async () => {
    const captureEvidence = vi.fn(() => replayEvidence())
    const validateLive = vi.fn(() => ({ kind: 'satisfied' as const }))
    const run = vi.fn(async () => successfulUpdateResult())
    const idempotencyPolicy = updateReplayPolicy({ captureEvidence, validateLive })

    setCliContext({
      idempotencyKey: 'policy-update',
      interactive: false,
      outputMode: 'json',
      runId: 'policy-first-run',
    })
    await executeCommandWithRuntime({ action: 'update', idempotencyPolicy, run, target: agentTarget('codex') })

    const stored = await loadVersionedIdempotencyRecord('policy-update')
    expect(stored.kind).toBe('valid')
    expect(captureEvidence).toHaveBeenCalledTimes(1)

    setCliContext({
      idempotencyKey: 'policy-update',
      interactive: false,
      outputMode: 'json',
      runId: 'policy-second-run',
    })
    const replayed = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy,
      run,
      target: agentTarget('codex'),
    })

    expect(run).toHaveBeenCalledTimes(1)
    expect(validateLive).toHaveBeenCalledWith(replayEvidence())
    expect(replayed.meta.runId).toBe('policy-second-run')
    expect(replayed.meta.mode).toBe('json')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"runId": "policy-second-run"'))
  })

  it('persists and replays composite batch-install evidence', async () => {
    const key = 'policy-batch-install'
    const captureEvidence = vi.fn(() => batchReplayEvidence())
    const validateLive = vi.fn(() => ({ kind: 'satisfied' as const }))
    const policy = batchInstallReplayPolicy({ captureEvidence, validateLive })
    const run = vi.fn(async () => successfulBatchInstallResult())

    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: 'batch-first' })
    await executeCommandWithRuntime({
      action: 'install',
      idempotencyPolicy: policy,
      run,
      target: agentTarget('another-agent,test-agent'),
    })

    const stored = await loadVersionedIdempotencyRecord(key)
    if (stored.kind !== 'valid') throw new Error('Expected valid composite replay evidence.')
    expect(stored.record.receipt.payload).toMatchObject({ kind: 'receipt-set' })
    expect(stored.record.postcondition.payload).toMatchObject({ kind: 'all-of' })

    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: 'batch-replay' })
    const replayed = await executeCommandWithRuntime({
      action: 'install',
      idempotencyPolicy: policy,
      run,
      target: agentTarget('another-agent,test-agent'),
    })

    expect(run).toHaveBeenCalledOnce()
    expect(validateLive).toHaveBeenCalledWith(batchReplayEvidence())
    expect(replayed.meta.runId).toBe('batch-replay')
  })

  it('does not persist composite evidence for partial batch failure or dry run', async () => {
    const captureEvidence = vi.fn(() => batchReplayEvidence())
    const policy = batchInstallReplayPolicy({ captureEvidence })

    setCliContext({
      idempotencyKey: 'batch-partial-failure',
      interactive: false,
      outputMode: 'json',
      runId: 'batch-partial-failure',
    })
    const partial = await executeCommandWithRuntime({
      action: 'install',
      idempotencyPolicy: policy,
      run: async () =>
        createErrorResult({
          action: 'install',
          data: {
            results: [
              { agent: 'another-agent', ok: true },
              { agent: 'test-agent', ok: false },
            ],
          },
          error: { code: 'INSTALL_FAILED', message: 'Some agents failed to install.' },
          target: agentTarget('another-agent,test-agent'),
        }),
      target: agentTarget('another-agent,test-agent'),
    })
    expect(partial.ok).toBe(false)
    expect(captureEvidence).not.toHaveBeenCalled()
    expect(await loadVersionedIdempotencyRecord('batch-partial-failure')).toEqual({ kind: 'missing' })

    setCliContext({
      dryRun: true,
      idempotencyKey: 'batch-dry-run',
      interactive: false,
      outputMode: 'json',
      runId: 'batch-dry-run',
    })
    const dryRun = await executeCommandWithRuntime({
      action: 'install',
      idempotencyPolicy: policy,
      run: async () =>
        createSuccessResult({
          action: 'install',
          data: { results: [] },
          target: agentTarget('another-agent,test-agent'),
          warnings: [{ code: 'DRY_RUN', message: 'Dry run: would install agents.' }],
        }),
      target: agentTarget('another-agent,test-agent'),
    })
    expect(dryRun.ok).toBe(true)
    expect(captureEvidence).not.toHaveBeenCalled()
    expect(await loadVersionedIdempotencyRecord('batch-dry-run')).toEqual({ kind: 'missing' })
  })

  it('rejects a changed batch target set without overwriting stored composite evidence', async () => {
    const key = 'batch-request-mismatch'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: 'batch-original' })
    await executeCommandWithRuntime({
      action: 'install',
      idempotencyPolicy: batchInstallReplayPolicy(),
      run: async () => successfulBatchInstallResult(),
      target: agentTarget('another-agent,test-agent'),
    })
    const path = getIdempotencyFilePath(key)
    const original = readFileSync(path, 'utf8')
    const run = vi.fn(async () => successfulBatchInstallResult())

    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: 'batch-changed' })
    const result = await executeCommandWithRuntime({
      action: 'install',
      idempotencyPolicy: batchInstallReplayPolicy({ targets: ['another-agent', 'cursor'] }),
      run,
      target: agentTarget('another-agent,cursor'),
    })

    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(run).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('replays verified absence after the lifecycle receipt was removed by the successful uninstall', async () => {
    let receiptPresent = true
    const observe = vi.fn(async () => absencePolicyObservation(receiptPresent))
    const observeProviderTarget = vi.fn(async (binding: LifecycleProviderBinding) => ({
      kind: 'success' as const,
      value: { kind: 'absent' as const, target: binding.target },
    }))
    const policyFactory = () =>
      createAgentAbsenceIdempotencyPolicy('ta', {
        isExecutablePresent: vi.fn(async () => false),
        observe,
        observeProviderTarget,
      })
    const run = vi.fn(async () => {
      receiptPresent = false
      return createSuccessResult({
        action: 'uninstall',
        data: { agent: { displayName: 'Test Agent', name: 'test-agent' }, changed: true },
        target: agentTarget('test-agent'),
      })
    })

    setCliContext({
      idempotencyKey: 'policy-uninstall',
      interactive: false,
      outputMode: 'json',
      runId: 'policy-uninstall-first',
    })
    await executeCommandWithRuntime({
      action: 'uninstall',
      idempotencyPolicy: policyFactory,
      run,
      target: agentTarget('ta'),
    })

    setCliContext({
      idempotencyKey: 'policy-uninstall',
      interactive: false,
      outputMode: 'json',
      runId: 'policy-uninstall-replay',
    })
    const replayed = await executeCommandWithRuntime({
      action: 'uninstall',
      idempotencyPolicy: policyFactory,
      run,
      target: agentTarget('ta'),
    })

    expect(run).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledTimes(3)
    expect(observeProviderTarget).toHaveBeenCalledTimes(2)
    expect(replayed.meta.runId).toBe('policy-uninstall-replay')
  })

  it('aborts the production absence validator on SIGTERM without starting reconciliation', async () => {
    const key = 'policy-uninstall-signal'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'ndjson', runId: key })
    await saveVersionedIdempotencyRecord(key, versionedAbsenceEvidence())
    const adapter = firstPartyProviderRegistry.get('bun')
    if (!adapter) throw new Error('Expected bun provider adapter.')
    let probeSignal: AbortSignal | undefined
    const observeProvider = vi.spyOn(adapter, 'observe').mockImplementation(
      request =>
        new Promise(resolve => {
          probeSignal = request.context.signal
          request.context.signal.addEventListener(
            'abort',
            () => resolve({ kind: 'cancelled', reason: String(request.context.signal.reason) }),
            { once: true },
          )
        }),
    )
    const run = vi.fn(async () => successfulUninstallResult())
    const beforeSigint = process.listenerCount('SIGINT')
    const beforeSigterm = process.listenerCount('SIGTERM')

    try {
      const execution = executeCommandWithRuntime({
        action: 'uninstall',
        idempotencyPolicy: () =>
          createAgentAbsenceIdempotencyPolicy('test-agent', {
            isExecutablePresent: vi.fn(async () => false),
            observe: vi.fn(async () => absencePolicyObservation(false)),
          }),
        run,
        target: agentTarget('test-agent'),
      })
      await vi.waitFor(() => expect(observeProvider).toHaveBeenCalledOnce())
      process.emit('SIGTERM')
      const result = await execution

      expect(result.error?.code).toBe('CANCELLED')
      expect(probeSignal?.aborted).toBe(true)
      expect(run).not.toHaveBeenCalled()
      expect(process.listenerCount('SIGINT')).toBe(beforeSigint)
      expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm)
    } finally {
      observeProvider.mockRestore()
    }
  })

  it('aborts the production absence validator on command timeout without starting reconciliation', async () => {
    const key = 'policy-uninstall-timeout'
    setCliContext({
      idempotencyKey: key,
      interactive: false,
      outputMode: 'json',
      runId: key,
      timeoutMs: 1000,
    })
    await saveVersionedIdempotencyRecord(key, versionedAbsenceEvidence())
    const adapter = firstPartyProviderRegistry.get('bun')
    if (!adapter) throw new Error('Expected bun provider adapter.')
    let probeSignal: AbortSignal | undefined
    const observeProvider = vi.spyOn(adapter, 'observe').mockImplementation(
      request =>
        new Promise(resolve => {
          probeSignal = request.context.signal
          request.context.signal.addEventListener(
            'abort',
            () => resolve({ kind: 'cancelled', reason: String(request.context.signal.reason) }),
            { once: true },
          )
        }),
    )
    const run = vi.fn(async () => successfulUninstallResult())

    try {
      const execution = executeCommandWithRuntime({
        action: 'uninstall',
        idempotencyPolicy: () =>
          createAgentAbsenceIdempotencyPolicy('test-agent', {
            isExecutablePresent: vi.fn(async () => false),
            observe: vi.fn(async () => absencePolicyObservation(false)),
          }),
        run,
        target: agentTarget('test-agent'),
      })
      const result = await execution

      expect(result.error?.code).toBe('TIMEOUT')
      expect(probeSignal?.aborted).toBe(true)
      expect(run).not.toHaveBeenCalled()
    } finally {
      observeProvider.mockRestore()
    }
  })

  it('constructs a lazy idempotency policy once only when a keyed mutation needs it', async () => {
    setCliContext({ idempotencyKey: 'lazy-policy', interactive: false, outputMode: 'json', runId: 'lazy-policy' })
    const policyFactory = vi.fn(async () => updateReplayPolicy())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: policyFactory,
      run: async () => successfulUpdateResult(),
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(true)
    expect(policyFactory).toHaveBeenCalledTimes(1)
    expect((await loadVersionedIdempotencyRecord('lazy-policy')).kind).toBe('valid')
  })

  it('applies the command timeout while a lazy idempotency policy is still resolving', async () => {
    setCliContext({
      idempotencyKey: 'lazy-policy-timeout',
      interactive: false,
      outputMode: 'json',
      runId: 'lazy-policy-timeout',
      timeoutMs: 1,
    })
    const run = vi.fn(async () => successfulUpdateResult())
    const execution = executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: () => new Promise<ReturnType<typeof updateReplayPolicy>>(() => {}),
      run,
      target: agentTarget('codex'),
    })

    const result = await Promise.race([
      execution,
      new Promise<'hung'>(resolve => {
        setTimeout(() => resolve('hung'), 50)
      }),
    ])

    expect(result).not.toBe('hung')
    if (result === 'hung') return
    expect(result.error?.code).toBe('TIMEOUT')
    expect(run).not.toHaveBeenCalled()
  })

  it('does not start command work when a policy factory resolves during timeout grace', async () => {
    setCliContext({
      idempotencyKey: 'lazy-policy-grace-timeout',
      interactive: false,
      outputMode: 'json',
      runId: 'lazy-policy-grace-timeout',
      timeoutMs: 10,
    })
    const run = vi.fn(async () => successfulUpdateResult())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: async () => {
        await new Promise(resolve => setTimeout(resolve, 15))
        return updateReplayPolicy()
      },
      run,
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('TIMEOUT')
    expect(run).not.toHaveBeenCalled()
  })

  it('does not emit a replay when live validation completes during timeout grace', async () => {
    const key = 'lazy-policy-validate-grace-timeout'
    setCliContext({
      idempotencyKey: key,
      interactive: false,
      outputMode: 'json',
      runId: key,
      timeoutMs: 10,
    })
    await saveVersionedIdempotencyRecord(key, versionedUpdateEvidence())
    const run = vi.fn(async () => successfulUpdateResult())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy({
        validateLive: async () => {
          await new Promise(resolve => setTimeout(resolve, 15))
          return { kind: 'satisfied' as const }
        },
      }),
      run,
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('TIMEOUT')
    expect(run).not.toHaveBeenCalled()
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('"status": "updated"')
  })

  it('cancels and cleans up signal listeners while a lazy policy is resolving', async () => {
    setCliContext({
      idempotencyKey: 'lazy-policy-signal',
      interactive: false,
      outputMode: 'json',
      runId: 'lazy-policy-signal',
    })
    const beforeSigint = process.listenerCount('SIGINT')
    const beforeSigterm = process.listenerCount('SIGTERM')
    const run = vi.fn(async () => successfulUpdateResult())
    const execution = executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: () => new Promise<ReturnType<typeof updateReplayPolicy>>(() => {}),
      run,
      target: agentTarget('codex'),
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    process.emit('SIGTERM')
    const result = await Promise.race([
      execution,
      new Promise<'hung'>(resolve => {
        setTimeout(() => resolve('hung'), 50)
      }),
    ])

    expect(result).not.toBe('hung')
    if (result === 'hung') return
    expect(result.error?.code).toBe('CANCELLED')
    expect(run).not.toHaveBeenCalled()
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint)
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm)
  })

  it('rejects retained invalid evidence before constructing a lazy policy', async () => {
    const key = 'invalid-before-lazy-policy'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    mkdirSync(getIdempotencyDir(), { recursive: true })
    writeFileSync(getIdempotencyFilePath(key), '{ invalid evidence\n', 'utf8')
    const policyFactory = vi.fn(() => {
      throw new Error('policy factory must not run')
    })
    const run = vi.fn(async () => successfulUpdateResult())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: policyFactory,
      run,
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(policyFactory).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('does not construct a lazy idempotency policy without an idempotency key', async () => {
    setCliContext({ interactive: false, outputMode: 'json', runId: 'unkeyed-lazy-policy' })
    const policyFactory = vi.fn(async () => updateReplayPolicy())

    const result = await executeCommandWithRuntime({
      action: 'ensure',
      idempotencyPolicy: policyFactory,
      run: async () => successfulUpdateResult(),
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(true)
    expect(policyFactory).not.toHaveBeenCalled()
  })

  it('keeps a verified success without storing when fresh policy evidence becomes inconclusive', async () => {
    setCliContext({
      idempotencyKey: 'inconclusive-capture',
      interactive: false,
      outputMode: 'json',
      runId: 'inconclusive-capture',
    })
    const policy = updateReplayPolicy({ captureEvidence: () => undefined })

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: policy,
      run: async () => successfulUpdateResult(),
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(true)
    expect(await loadVersionedIdempotencyRecord('inconclusive-capture')).toEqual({ kind: 'missing' })
  })

  it('rejects retained invalid versioned evidence without running or overwriting it', async () => {
    setCliContext({
      idempotencyKey: 'invalid-policy-evidence',
      interactive: false,
      outputMode: 'json',
      runId: 'invalid-policy-run',
    })
    mkdirSync(getIdempotencyDir(), { recursive: true })
    const path = getIdempotencyFilePath('invalid-policy-evidence')
    const bytes = '{ corrupt replay evidence\n'
    writeFileSync(path, bytes, 'utf8')
    const run = vi.fn(async () => successfulUpdateResult())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy(),
      run,
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(result.error?.details).toEqual({
      idempotencyKey: 'invalid-policy-evidence',
      invalidReason: 'invalid-json',
      reason: 'invalid-evidence',
    })
    expect(run).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf8')).toBe(bytes)
  })

  it('rejects canonical request mismatch with stable public diagnostics and preserves stored evidence', async () => {
    setCliContext({
      idempotencyKey: 'request-mismatch',
      interactive: false,
      outputMode: 'json',
      runId: 'request-mismatch-run',
    })
    await saveVersionedIdempotencyRecord('request-mismatch', versionedUpdateEvidence())
    const path = getIdempotencyFilePath('request-mismatch')
    const bytes = readFileSync(path, 'utf8')
    const requestedPolicy = updateReplayPolicy({ targets: ['cursor'] })
    const run = vi.fn(async () => successfulUpdateResult('cursor'))

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: requestedPolicy,
      run,
      target: agentTarget('cursor'),
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(result.error?.details).toEqual({
      existingAction: 'update',
      idempotencyKey: 'request-mismatch',
      reason: 'request-mismatch',
    })
    expect(run).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf8')).toBe(bytes)
  })

  it.each([
    {
      bytes: () => `${JSON.stringify({ ...storedVersionedUpdateEvidence(), schemaVersion: 2 })}\n`,
      reason: 'unsupported-schema',
    },
    {
      bytes: () =>
        `${JSON.stringify({
          action: 'update',
          createdAt: '2026-07-13T00:00:00.000Z',
          expiresAt: '2026-07-14T00:00:00.000Z',
          result: successfulUpdateResult(),
        })}\n`,
      reason: 'legacy-record',
    },
    {
      bytes: () => {
        const record = storedVersionedUpdateEvidence()
        return `${JSON.stringify({
          ...record,
          request: { ...record.request, fingerprint: '0'.repeat(64) },
        })}\n`
      },
      reason: 'fingerprint-mismatch',
    },
  ] as const)('rejects retained $reason evidence at the versioned runtime boundary', async ({ bytes, reason }) => {
    const key = `retained-${reason}`
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    mkdirSync(getIdempotencyDir(), { recursive: true })
    const path = getIdempotencyFilePath(key)
    const original = bytes()
    writeFileSync(path, original, 'utf8')
    const run = vi.fn(async () => successfulUpdateResult())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy(),
      run,
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(result.error?.details).toEqual({
      idempotencyKey: key,
      invalidReason: reason,
      reason: 'invalid-evidence',
    })
    expect(run).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it.each([
    { live: 'satisfied' as const, resolvedVersion: '1.2.4', scenario: 'resolved plan changed' },
    { live: 'drifted' as const, resolvedVersion: '1.2.3', scenario: 'live evidence drifted' },
    { live: 'inconclusive' as const, resolvedVersion: '1.2.3', scenario: 'live evidence was inconclusive' },
  ])('reconciles and replaces evidence when $scenario', async ({ live, resolvedVersion }) => {
    const key = `reconcile-${live}-${resolvedVersion}`
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    await saveVersionedIdempotencyRecord(key, versionedUpdateEvidence())
    const validateLive = vi.fn(() => ({ kind: live }))
    const run = vi.fn(async () => successfulUpdateResult())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy({ resolvedVersion, validateLive }),
      run,
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    if (resolvedVersion === '1.2.4') expect(validateLive).not.toHaveBeenCalled()
    else expect(validateLive).toHaveBeenCalledTimes(1)
    const stored = await loadVersionedIdempotencyRecord(key)
    if (stored.kind !== 'valid') throw new Error('Expected replaced replay evidence.')
    expect(stored.record.resolvedPlan.fingerprint).toBe(
      fingerprintCanonicalValue(updateReplayPolicy({ resolvedVersion }).resolvedPlan),
    )
  })

  it('retains prior evidence when drift reconciliation does not succeed', async () => {
    const key = 'failed-drift-reconciliation'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    await saveVersionedIdempotencyRecord(key, versionedUpdateEvidence())
    const path = getIdempotencyFilePath(key)
    const original = readFileSync(path, 'utf8')

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy({ validateLive: () => ({ kind: 'drifted' }) }),
      run: async () =>
        createErrorResult({
          action: 'update',
          error: { code: 'UPDATE_FAILED', message: 'Update failed.' },
          target: agentTarget('codex'),
        }),
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('skips versioned replay and persistence for dry runs, retaining existing invalid bytes', async () => {
    const key = 'policy-dry-run'
    setCliContext({
      dryRun: true,
      idempotencyKey: key,
      interactive: false,
      outputMode: 'json',
      runId: key,
    })
    mkdirSync(getIdempotencyDir(), { recursive: true })
    const path = getIdempotencyFilePath(key)
    const original = '{ retained invalid bytes\n'
    writeFileSync(path, original, 'utf8')
    const captureEvidence = vi.fn(() => replayEvidence())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy({ captureEvidence }),
      run: async () =>
        createSuccessResult({
          action: 'update',
          data: { status: 'planned' },
          target: agentTarget('codex'),
          warnings: [{ code: 'DRY_RUN', message: 'Dry run: would update Codex.' }],
        }),
      target: agentTarget('codex'),
    })

    expect(result.ok).toBe(true)
    expect(captureEvidence).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('does not persist a timed-out policy-backed invocation', async () => {
    const key = 'policy-timeout'
    setCliContext({
      idempotencyKey: key,
      interactive: false,
      outputMode: 'json',
      runId: key,
      timeoutMs: 1,
    })
    const captureEvidence = vi.fn(() => replayEvidence())

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy({ captureEvidence }),
      run: () => new Promise<CommandResult<unknown>>(() => {}),
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('TIMEOUT')
    expect(captureEvidence).not.toHaveBeenCalled()
    expect(await loadVersionedIdempotencyRecord(key)).toEqual({ kind: 'missing' })
  })

  it('does not persist a late success after signal cancellation wins the runtime race', async () => {
    const key = 'policy-signal-cancelled'
    setCliContext({
      idempotencyKey: key,
      interactive: false,
      outputMode: 'ndjson',
      runId: key,
    })
    const captureEvidence = vi.fn(() => replayEvidence())
    let finishRun!: (result: CommandResult<{ status: string }>) => void
    let markRunStarted!: () => void
    const runStarted = new Promise<void>(resolve => {
      markRunStarted = resolve
    })
    const execution = executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy({ captureEvidence }),
      run: () =>
        new Promise<CommandResult<{ status: string }>>(resolve => {
          finishRun = resolve
          markRunStarted()
        }),
      target: agentTarget('codex'),
    })

    await runStarted
    process.emit('SIGTERM')
    const cancelled = await execution
    expect(cancelled.error?.code).toBe('CANCELLED')

    finishRun(successfulUpdateResult())
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(captureEvidence).not.toHaveBeenCalled()
    expect(await loadVersionedIdempotencyRecord(key)).toEqual({ kind: 'missing' })
  })

  it('propagates versioned storage failures after a successful policy-backed run', async () => {
    const key = 'policy-storage-failure'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    const captureEvidence = vi.fn(() => replayEvidence())

    await expect(
      executeCommandWithRuntime({
        action: 'update',
        idempotencyPolicy: updateReplayPolicy({ captureEvidence }),
        run: async () => {
          mkdirSync(join(tempHome, '.quantex'), { recursive: true })
          writeFileSync(getIdempotencyDir(), 'blocks the idempotency directory', 'utf8')
          return successfulUpdateResult()
        },
        target: agentTarget('codex'),
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/ENOTDIR|EISDIR/) })
    expect(captureEvidence).toHaveBeenCalledTimes(1)
  })

  it('does not apply legacy idempotency storage to read-only commands', async () => {
    const key = 'read-only-list'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    const run = vi.fn(async () =>
      createSuccessResult({
        action: 'list',
        data: { agents: [] },
        target: { kind: 'system' as const, name: 'agents' },
      }),
    )

    await executeCommandWithRuntime({ action: 'list', run, target: { kind: 'system', name: 'agents' } })
    await executeCommandWithRuntime({ action: 'list', run, target: { kind: 'system', name: 'agents' } })

    expect(run).toHaveBeenCalledTimes(2)
    expect(await loadIdempotencyRecord(key)).toBeUndefined()
    expect(await loadVersionedIdempotencyRecord(key)).toEqual({ kind: 'missing' })
  })

  it('never loads or persists replay evidence for read-only commands even if a policy is supplied', async () => {
    const key = 'read-only-policy'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    mkdirSync(getIdempotencyDir(), { recursive: true })
    const path = getIdempotencyFilePath(key)
    const original = '{ retained read-only bytes\n'
    writeFileSync(path, original, 'utf8')
    const captureEvidence = vi.fn(() => replayEvidence())
    const run = vi.fn(async () =>
      createSuccessResult({
        action: 'list',
        data: { agents: [] },
        target: { kind: 'system' as const, name: 'agents' },
      }),
    )

    const result = await executeCommandWithRuntime({
      action: 'list',
      idempotencyPolicy: updateReplayPolicy({ captureEvidence }),
      run,
      target: { kind: 'system', name: 'agents' },
    })

    expect(result.ok).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    expect(captureEvidence).not.toHaveBeenCalled()
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('refuses to overwrite a different valid request that appears while the command runs', async () => {
    const key = 'concurrent-request-conflict'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    const concurrent = versionedUpdateEvidence({ targets: ['cursor'] })
    let concurrentBytes = ''

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy(),
      run: async () => {
        await saveVersionedIdempotencyRecord(key, concurrent)
        concurrentBytes = readFileSync(getIdempotencyFilePath(key), 'utf8')
        return successfulUpdateResult()
      },
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(result.error?.details).toEqual({
      conflict: 'concurrent-request-mismatch',
      existingAction: 'update',
      idempotencyKey: key,
    })
    expect(readFileSync(getIdempotencyFilePath(key), 'utf8')).toBe(concurrentBytes)
  })

  it('refuses to overwrite invalid evidence that appears while the command runs', async () => {
    const key = 'concurrent-invalid-conflict'
    setCliContext({ idempotencyKey: key, interactive: false, outputMode: 'json', runId: key })
    const bytes = '{ concurrent invalid evidence\n'

    const result = await executeCommandWithRuntime({
      action: 'update',
      idempotencyPolicy: updateReplayPolicy(),
      run: async () => {
        mkdirSync(getIdempotencyDir(), { recursive: true })
        writeFileSync(getIdempotencyFilePath(key), bytes, 'utf8')
        return successfulUpdateResult()
      },
      target: agentTarget('codex'),
    })

    expect(result.error?.code).toBe('INVALID_ARGUMENT')
    expect(result.error?.details).toEqual({
      idempotencyKey: key,
      invalidReason: 'invalid-json',
      reason: 'invalid-evidence',
    })
    expect(readFileSync(getIdempotencyFilePath(key), 'utf8')).toBe(bytes)
  })

  it('returns a cancelled error when the process receives a termination signal', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'signal-run-id',
    })

    const execution = executeCommandWithRuntime({
      action: 'update',
      run: () => new Promise<CommandResult<unknown>>(() => {}),
      target: {
        kind: 'agent',
        name: 'codex',
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    process.emit('SIGTERM')

    const result = await execution
    const cancelledEvent = JSON.parse(logSpy.mock.calls[0][0])
    expect(cancelledEvent.type).toBe('cancelled')
    expect(cancelledEvent.data.signal).toBe('SIGTERM')
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CANCELLED')
  })

  it('waits for cancellation cleanup before returning a signal cancellation result', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'ndjson',
      runId: 'signal-cleanup-run-id',
    })

    let cleanupFinished = false
    let releaseCleanup!: () => void
    registerCliCancellationHandler(
      () =>
        new Promise<void>(resolve => {
          releaseCleanup = () => {
            cleanupFinished = true
            resolve()
          }
        }),
    )

    const execution = executeCommandWithRuntime({
      action: 'install',
      run: () => new Promise<CommandResult<unknown>>(() => {}),
      target: {
        kind: 'agent',
        name: 'vtcode',
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))
    process.emit('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 0))

    let settled = false
    void execution.then(() => {
      settled = true
      return undefined
    })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(settled).toBe(false)
    expect(cleanupFinished).toBe(false)

    releaseCleanup()

    const result = await execution
    expect(cleanupFinished).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CANCELLED')
  })

  it('shows a passive self-update notice after a successful human-mode command', async () => {
    const noticeSpy = vi.spyOn(updateNotice, 'maybeRenderSelfUpdateNotice')
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'human-run-id',
    })

    const result = await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: { agents: [] },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(result.ok).toBe(true)
    expect(noticeSpy).toHaveBeenCalledWith({ action: 'list', ok: true })
    noticeSpy.mockRestore()
  })

  it('suppresses the passive notice in structured output modes', async () => {
    const noticeSpy = vi.spyOn(updateNotice, 'maybeRenderSelfUpdateNotice')
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'json-run-id',
    })

    await executeCommandWithRuntime({
      action: 'list',
      run: async () =>
        createSuccessResult({
          action: 'list',
          data: { agents: [] },
          target: {
            kind: 'system',
            name: 'agents',
          },
        }),
      target: {
        kind: 'system',
        name: 'agents',
      },
    })

    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(noticeSpy).toHaveBeenCalledWith({ action: 'list', ok: true })
    noticeSpy.mockRestore()
  })

  it('suppresses repeated reminders for the same target version inside the throttle window', () => {
    const now = Date.parse('2026-05-01T08:00:00.000Z')

    expect(updateNotice.shouldSuppressUpdateNotice('1.1.0', '2026-05-01T00:00:00.000Z', '1.1.0', now)).toBe(true)
    expect(updateNotice.shouldSuppressUpdateNotice('1.1.0', '2026-04-30T07:59:59.999Z', '1.1.0', now)).toBe(false)
  })

  it('skips passive reminders for doctor because that command owns self-upgrade messaging', async () => {
    const noticeSpy = vi.spyOn(updateNotice, 'maybeRenderSelfUpdateNotice')
    inspectSelfSpy.mockResolvedValue({
      canAutoUpdate: true,
      currentVersion: '1.0.0',
      executablePath: '/tmp/quantex',
      installSource: 'npm',
      latestVersion: '1.1.0',
      packageRoot: '/tmp/quantex',
      recommendedUpgradeCommand: 'quantex upgrade',
      updateChannel: 'stable',
    })

    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'doctor-run-id',
    })

    await executeCommandWithRuntime({
      action: 'doctor',
      run: async () =>
        createSuccessResult({
          action: 'doctor',
          data: { issues: [] },
          target: {
            kind: 'system',
            name: 'doctor',
          },
        }),
      target: {
        kind: 'system',
        name: 'doctor',
      },
    })

    expect(inspectSelfSpy).not.toHaveBeenCalled()
    expect(noticeSpy).toHaveBeenCalledWith({ action: 'doctor', ok: true })
    noticeSpy.mockRestore()
  })
})

function agentTarget(name: string) {
  return { kind: 'agent' as const, name }
}

function successfulUpdateResult(agent = 'codex') {
  return createSuccessResult({
    action: 'update',
    data: { status: 'updated' },
    target: agentTarget(agent),
  })
}

function successfulUninstallResult() {
  return createSuccessResult({
    action: 'uninstall',
    data: { agent: { displayName: 'Test Agent', name: 'test-agent' }, changed: true },
    target: agentTarget('test-agent'),
  })
}

function successfulBatchInstallResult() {
  return createSuccessResult({
    action: 'install',
    data: {
      results: [
        { agent: { name: 'another-agent' }, ok: true },
        { agent: { name: 'test-agent' }, ok: true },
      ],
      scope: 'batch',
    },
    target: agentTarget('another-agent,test-agent'),
  })
}

function replayEvidence(): {
  postcondition: IdempotencyPostcondition
  receipt: IdempotencyReceiptSnapshot
} {
  return {
    postcondition: {
      expectedVersion: '1.2.3',
      kind: 'version-satisfies',
      targetId: 'codex',
    },
    receipt: {
      providerId: 'npm',
      schemaVersion: 1,
      targetId: 'codex',
      version: '1.2.3',
    },
  }
}

function absencePolicyObservation(receiptPresent: boolean): ResolvedAgentObservation {
  const binding = {
    providerId: 'bun' as const,
    target: { id: 'test-pkg', kind: 'package' as const },
  }
  return {
    agent: {
      binaryName: 'test-bin',
      displayName: 'Test Agent',
      homepage: 'https://example.com',
      lookupAliases: ['ta'],
      name: 'test-agent',
      packages: { npm: 'test-pkg' },
      platforms: {
        linux: [{ type: 'bun' }],
        macos: [{ type: 'bun' }],
        windows: [{ type: 'bun' }],
      },
    },
    binding: receiptPresent ? binding : undefined,
    capabilities: receiptPresent ? ['observe', 'uninstall'] : [],
    catalogMethods: [binding],
    executable: { present: receiptPresent },
    latestVersion: undefined,
    methods: [{ type: 'bun' }],
    observation: receiptPresent
      ? {
          drift: { kind: 'none' },
          kind: 'present',
          providerId: 'bun',
          providerTargetId: 'test-pkg',
          providerTargetKind: 'package',
          targetId: 'test-agent',
        }
      : { drift: { kind: 'none' }, kind: 'absent', targetId: 'test-agent' },
    pathExecutable: { present: receiptPresent },
    persistedBinding: receiptPresent ? binding : undefined,
    providerOutcome: receiptPresent
      ? { kind: 'success', value: { kind: 'present', target: binding.target } }
      : undefined,
    receipt: receiptPresent
      ? {
          executableName: 'test-bin',
          kind: 'lifecycle-receipt',
          providerId: 'bun',
          providerTargetId: 'test-pkg',
          providerTargetKind: 'package',
          schemaVersion: 1,
          targetId: 'test-agent',
          verifiedAt: '2026-07-13T00:00:00.000Z',
        }
      : undefined,
  }
}

function updateReplayPolicy(
  options: {
    captureEvidence?: () => ReturnType<typeof replayEvidence> | undefined
    resolvedVersion?: string
    targets?: readonly string[]
    validateLive?: () =>
      | Promise<{ kind: 'drifted' | 'inconclusive' | 'satisfied' }>
      | { kind: 'drifted' | 'inconclusive' | 'satisfied' }
  } = {},
) {
  const targets = options.targets ?? ['codex']
  return {
    captureEvidence: options.captureEvidence ?? (() => replayEvidence()),
    request: canonicalizeMutationRequest({
      action: 'update',
      options: { requestedVersion: 'latest' },
      targets,
    }),
    resolvedPlan: {
      requestedVersion: 'latest',
      resolvedVersion: options.resolvedVersion ?? '1.2.3',
      targets: [...targets].sort(),
    },
    validateLive: options.validateLive ?? (() => ({ kind: 'satisfied' as const })),
  }
}

function batchInstallReplayPolicy(
  options: {
    captureEvidence?: () => ReturnType<typeof batchReplayEvidence> | undefined
    targets?: readonly string[]
    validateLive?: () =>
      | Promise<{ kind: 'drifted' | 'inconclusive' | 'satisfied' }>
      | { kind: 'drifted' | 'inconclusive' | 'satisfied' }
  } = {},
) {
  const targets = options.targets ?? ['another-agent', 'test-agent']
  return {
    captureEvidence: options.captureEvidence ?? (() => batchReplayEvidence()),
    request: canonicalizeMutationRequest({ action: 'install', targets }),
    resolvedPlan: {
      kind: 'agent-presence-batch',
      targets: targets.map(targetId => ({ candidates: [], targetId })),
    },
    validateLive: options.validateLive ?? (() => ({ kind: 'satisfied' as const })),
  }
}

function batchReplayEvidence(): {
  postcondition: IdempotencyPostcondition
  receipt: IdempotencyReceiptEvidence
} {
  return {
    postcondition: canonicalizeAllOfPostcondition([
      {
        agentTargetId: 'another-agent',
        kind: 'package-present',
        providerId: 'npm',
        targetId: 'another-pkg',
      },
      {
        agentTargetId: 'test-agent',
        kind: 'package-present',
        providerId: 'bun',
        targetId: 'test-pkg',
      },
    ]),
    receipt: canonicalizeReceiptSet([
      {
        agentTargetId: 'another-agent',
        providerId: 'npm',
        schemaVersion: 1,
        targetId: 'another-pkg',
      },
      {
        agentTargetId: 'test-agent',
        providerId: 'bun',
        schemaVersion: 1,
        targetId: 'test-pkg',
      },
    ]),
  }
}

function versionedUpdateEvidence(
  options: { resolvedVersion?: string; targets?: readonly string[] } = {},
): VersionedIdempotencyRecordInput {
  const policy = updateReplayPolicy(options)
  const evidence = replayEvidence()
  return {
    postcondition: fingerprinted(evidence.postcondition),
    receipt: fingerprinted(evidence.receipt),
    request: fingerprinted(policy.request),
    resolvedPlan: fingerprinted(policy.resolvedPlan),
    result: successfulUpdateResult(),
  }
}

function versionedAbsenceEvidence(): VersionedIdempotencyRecordInput {
  const evidence = {
    postcondition: {
      agentTargetId: 'test-agent',
      kind: 'package-absent' as const,
      providerId: 'bun',
      targetId: 'test-pkg',
    },
    receipt: {
      agentTargetId: 'test-agent',
      executableName: 'test-bin',
      providerId: 'bun',
      providerTargetKind: 'package',
      schemaVersion: 1,
      targetId: 'test-pkg',
    },
  }
  return {
    postcondition: fingerprinted(evidence.postcondition),
    receipt: fingerprinted(evidence.receipt),
    request: fingerprinted(canonicalizeMutationRequest({ action: 'uninstall', targets: ['test-agent'] })),
    resolvedPlan: fingerprinted({ kind: 'agent-absence', targetId: 'test-agent' }),
    result: successfulUninstallResult(),
  }
}

function storedVersionedUpdateEvidence(options: { resolvedVersion?: string; targets?: readonly string[] } = {}) {
  return {
    ...versionedUpdateEvidence(options),
    createdAt: '2026-07-13T00:00:00.000Z',
    expiresAt: '2026-07-14T00:00:00.000Z',
    schemaVersion: 1,
  }
}

function fingerprinted<T>(payload: T) {
  return { fingerprint: fingerprintCanonicalValue(payload), payload }
}
