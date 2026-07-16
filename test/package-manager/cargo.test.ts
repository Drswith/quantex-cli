import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.hoisted(() => vi.fn())
const mutationRun = vi.hoisted(() => vi.fn())
let originalSpawn: typeof Bun.spawn

vi.mock('cross-spawn', async () => {
  const { createCrossSpawnMock } = await import('../helpers/cross-spawn-mock')
  return { default: createCrossSpawnMock(mockSpawn) }
})

vi.mock('../../src/package-manager/mutation-outcome', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/package-manager/mutation-outcome')>()
  return {
    ...actual,
    runPackageMutationOutcome: mutationRun,
    runPackageMutationSequence: async (
      commands: readonly (readonly string[])[],
      context: unknown,
      description: string,
    ) => {
      for (const command of commands) {
        const outcome = await mutationRun(command, context, description)
        if (outcome.kind !== 'success') return outcome
      }
      return { kind: 'success', value: undefined }
    },
  }
})

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
  mutationRun.mockImplementation(runMutation)
})

afterEach(() => {
  Bun.spawn = originalSpawn
  mockSpawn.mockClear()
  mutationRun.mockClear()
})

async function runMutation(command: readonly string[], _context: unknown, description: string) {
  const proc = mockSpawn(command, { detached: process.platform !== 'win32' })
  await proc.exited
  return proc.exitCode === 0
    ? { kind: 'success', value: undefined }
    : { command, exitCode: proc.exitCode, kind: 'failed', reason: description, retryable: false }
}

describe('cargo install', () => {
  it('returns true on success', async () => {
    const { install } = await import('../../src/package-manager/cargo')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('some-crate')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['cargo', 'install', 'some-crate'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/cargo')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })

    expect(await install('some-crate')).toBe(false)
  })

  it('passes cargo install args after the crate name', async () => {
    const { install } = await import('../../src/package-manager/cargo')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('some-crate', ['--locked'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['cargo', 'install', 'some-crate', '--locked'], expect.any(Object))
  })
})

describe('cargo update', () => {
  it('re-runs cargo install for the crate', async () => {
    const { update } = await import('../../src/package-manager/cargo')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await update('some-crate', ['--locked'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['cargo', 'install', 'some-crate', '--force', '--locked'],
      expect.any(Object),
    )
  })
})

describe('cargo updateMany', () => {
  it('updates crates sequentially', async () => {
    const { updateMany } = await import('../../src/package-manager/cargo')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(
      await updateMany([
        { packageInstallArgs: ['--locked'], packageName: 'some-crate' },
        { packageName: 'other-crate' },
      ]),
    ).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(
      1,
      ['cargo', 'install', 'some-crate', '--force', '--locked'],
      expect.any(Object),
    )
    expect(mockSpawn).toHaveBeenNthCalledWith(2, ['cargo', 'install', 'other-crate', '--force'], expect.any(Object))
  })
})

describe('cargo uninstall', () => {
  it('returns true on success', async () => {
    const { uninstall } = await import('../../src/package-manager/cargo')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await uninstall('some-crate')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['cargo', 'uninstall', 'some-crate'], expect.any(Object))
  })
})
