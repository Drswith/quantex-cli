import type { ProviderOperationContext } from '../../src/providers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runPackageMutationOutcome, runPackageMutationSequence } from '../../src/package-manager/context-mutation'
import { ProcessInterruptionError } from '../../src/utils/child-process'

const runCommandWithContext = vi.hoisted(() => vi.fn())

vi.mock('../../src/utils/child-process', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/utils/child-process')>()
  return { ...actual, runCommandWithContext }
})

const context: ProviderOperationContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
}

beforeEach(() => {
  runCommandWithContext.mockReset()
})

describe('context-native package mutation', () => {
  it('preserves successful and failed exit-code outcomes while forwarding the explicit context', async () => {
    runCommandWithContext.mockResolvedValueOnce(0).mockResolvedValueOnce(7)
    const command = ['npm', 'install', '-g', 'example'] as const

    await expect(runPackageMutationOutcome(command, context, 'npm install failed')).resolves.toEqual({
      kind: 'success',
      value: undefined,
    })
    await expect(runPackageMutationOutcome(command, context, 'npm install failed')).resolves.toEqual({
      command,
      exitCode: 7,
      kind: 'failed',
      reason: 'npm install failed with exit code 7',
      retryable: false,
    })
    expect(runCommandWithContext).toHaveBeenCalledWith(command, context, {
      detached: process.platform !== 'win32',
    })
  })

  it('keeps cancellation and timeout outcomes typed', async () => {
    runCommandWithContext
      .mockRejectedValueOnce(new ProcessInterruptionError({ kind: 'cancelled', reason: 'user request' }))
      .mockRejectedValueOnce(new ProcessInterruptionError({ kind: 'timed-out', timeoutMs: 125 }))

    await expect(runPackageMutationOutcome(['npm'], context, 'npm failed')).resolves.toEqual({
      kind: 'cancelled',
      reason: 'user request',
    })
    await expect(runPackageMutationOutcome(['npm'], context, 'npm failed')).resolves.toEqual({
      kind: 'timed-out',
      timeoutMs: 125,
    })
  })

  it('stops a mutation sequence at the first typed failure', async () => {
    runCommandWithContext.mockResolvedValueOnce(0).mockResolvedValueOnce(3)
    const commands = [['first'], ['second'], ['third']] as const

    await expect(runPackageMutationSequence(commands, context, 'sequence failed')).resolves.toMatchObject({
      command: commands[1],
      exitCode: 3,
      kind: 'failed',
    })
    expect(runCommandWithContext).toHaveBeenCalledTimes(2)
  })
})
