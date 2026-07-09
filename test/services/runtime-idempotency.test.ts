import type { CommandResult, CommandTarget } from '../../src/output/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  persistIdempotentExecution,
  resolveIdempotentExecution,
  type RuntimeIdempotencyDependencies,
  type RuntimeIdempotencyInvocation,
} from '../../src/services/runtime-idempotency'

const target: CommandTarget = {
  kind: 'agent',
  name: 'codex',
}

function createResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    action: 'install',
    error: null,
    meta: {
      mode: 'json',
      runId: 'stored-run',
      schemaVersion: '1',
      timestamp: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
    },
    ok: true,
    target,
    warnings: [],
    ...overrides,
  }
}

function createInvocation(overrides: Partial<RuntimeIdempotencyInvocation> = {}): RuntimeIdempotencyInvocation {
  return {
    action: 'install',
    dryRun: false,
    idempotencyKey: 'job-1',
    outputMode: 'ndjson',
    runId: 'current-run',
    target,
    ...overrides,
  }
}

function createDependencies(): RuntimeIdempotencyDependencies {
  return {
    loadIdempotencyRecord: vi.fn(),
    now: vi.fn(() => '2026-07-09T00:00:00.000Z'),
    resolveAgentInspection: vi.fn(),
    saveIdempotencyRecord: vi.fn(),
  }
}

function createStoredRecord(
  overrides: Partial<{
    action: string
    result: CommandResult
    target: CommandTarget
  }> = {},
) {
  return {
    action: overrides.action ?? 'install',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    result: overrides.result ?? createResult(),
    target: overrides.target ?? target,
  }
}

describe('runtime idempotency service', () => {
  let dependencies: RuntimeIdempotencyDependencies

  beforeEach(() => {
    dependencies = createDependencies()
  })

  it('returns a miss without loading storage when no key is supplied', async () => {
    const result = await resolveIdempotentExecution(createInvocation({ idempotencyKey: undefined }), dependencies)

    expect(result).toEqual({ kind: 'miss' })
    expect(dependencies.loadIdempotencyRecord).not.toHaveBeenCalled()
  })

  it('returns a command-neutral conflict when a key belongs to another action', async () => {
    vi.mocked(dependencies.loadIdempotencyRecord).mockResolvedValue(
      createStoredRecord({
        action: 'uninstall',
      }),
    )

    const result = await resolveIdempotentExecution(createInvocation(), dependencies)

    expect(result).toEqual({
      existingAction: 'uninstall',
      idempotencyKey: 'job-1',
      kind: 'conflict',
    })
  })

  it('returns a miss for a different target', async () => {
    vi.mocked(dependencies.loadIdempotencyRecord).mockResolvedValue(
      createStoredRecord({
        target: {
          kind: 'agent',
          name: 'claude',
        },
      }),
    )

    await expect(resolveIdempotentExecution(createInvocation(), dependencies)).resolves.toEqual({
      kind: 'miss',
    })
  })

  it('does not replay a stored dry-run result', async () => {
    vi.mocked(dependencies.loadIdempotencyRecord).mockResolvedValue(
      createStoredRecord({
        result: createResult({
          warnings: [
            {
              code: 'DRY_RUN',
              message: 'No changes were made.',
            },
          ],
        }),
      }),
    )

    await expect(resolveIdempotentExecution(createInvocation(), dependencies)).resolves.toEqual({
      kind: 'miss',
    })
  })

  it.each([
    {
      action: 'install',
      inPath: false,
    },
    {
      action: 'uninstall',
      inPath: true,
    },
  ])('does not replay stale $action lifecycle success', async ({ action, inPath }) => {
    vi.mocked(dependencies.loadIdempotencyRecord).mockResolvedValue(
      createStoredRecord({
        action,
        result: createResult({ action }),
      }),
    )
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue({
      agent: {} as never,
      inspection: {
        inPath,
      } as never,
    })

    await expect(resolveIdempotentExecution(createInvocation({ action }), dependencies)).resolves.toEqual({
      kind: 'miss',
    })
  })

  it('refreshes replay metadata for the current invocation', async () => {
    vi.mocked(dependencies.loadIdempotencyRecord).mockResolvedValue(createStoredRecord())
    vi.mocked(dependencies.resolveAgentInspection).mockResolvedValue({
      agent: {} as never,
      inspection: {
        inPath: true,
      } as never,
    })

    const result = await resolveIdempotentExecution(createInvocation(), dependencies)

    expect(result).toEqual({
      kind: 'replay',
      result: expect.objectContaining({
        meta: expect.objectContaining({
          mode: 'ndjson',
          runId: 'current-run',
          timestamp: '2026-07-09T00:00:00.000Z',
        }),
      }),
    })
  })

  it.each([
    {
      dryRun: false,
      key: 'job-1',
      result: createResult(),
      saves: true,
    },
    {
      dryRun: false,
      key: undefined,
      result: createResult(),
      saves: false,
    },
    {
      dryRun: true,
      key: 'job-1',
      result: createResult(),
      saves: false,
    },
    {
      dryRun: false,
      key: 'job-1',
      result: createResult({
        error: {
          code: 'INSTALL_FAILED',
          message: 'failed',
        },
        ok: false,
      }),
      saves: false,
    },
    {
      dryRun: false,
      key: 'job-1',
      result: createResult({
        warnings: [
          {
            code: 'DRY_RUN',
            message: 'No changes were made.',
          },
        ],
      }),
      saves: false,
    },
  ])('persists only eligible successful results: $saves', async ({ dryRun, key, result, saves }) => {
    await persistIdempotentExecution(
      createInvocation({
        dryRun,
        idempotencyKey: key,
      }),
      result,
      dependencies,
    )

    if (saves) {
      expect(dependencies.saveIdempotencyRecord).toHaveBeenCalledWith('job-1', {
        action: 'install',
        result,
        target,
      })
    } else {
      expect(dependencies.saveIdempotencyRecord).not.toHaveBeenCalled()
    }
  })
})
