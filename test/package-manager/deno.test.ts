import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.fn()
const mutationRun = vi.hoisted(() => vi.fn())
let originalSpawn: typeof Bun.spawn

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

describe('deno install', () => {
  it('runs deno global install for the package', async () => {
    const { install } = await import('../../src/package-manager/deno')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('npm:@scope/tool')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['deno', 'install', '--global', 'npm:@scope/tool'], expect.any(Object))
  })

  it('passes Deno install args before the package name', async () => {
    const { install } = await import('../../src/package-manager/deno')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('jsr:@scope/tool', ['--allow-net', '--name', 'tool'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['deno', 'install', '--global', '--allow-net', '--name', 'tool', 'jsr:@scope/tool'],
      expect.any(Object),
    )
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/deno')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })

    expect(await install('npm:@scope/tool')).toBe(false)
  })
})

describe('deno update', () => {
  it('reinstalls the global executable with --force', async () => {
    const { update } = await import('../../src/package-manager/deno')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await update('jsr:@scope/tool', ['--allow-net'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['deno', 'install', '--global', '--force', '--allow-net', 'jsr:@scope/tool'],
      expect.any(Object),
    )
  })
})

describe('deno updateMany', () => {
  it('updates tools sequentially', async () => {
    const { updateMany } = await import('../../src/package-manager/deno')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(
      await updateMany([
        { packageInstallArgs: ['--allow-net'], packageName: 'jsr:@scope/tool' },
        { packageName: 'npm:@scope/other-tool' },
      ]),
    ).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(
      1,
      ['deno', 'install', '--global', '--force', '--allow-net', 'jsr:@scope/tool'],
      expect.any(Object),
    )
    expect(mockSpawn).toHaveBeenNthCalledWith(
      2,
      ['deno', 'install', '--global', '--force', 'npm:@scope/other-tool'],
      expect.any(Object),
    )
  })
})

describe('deno uninstall', () => {
  it('uninstalls by executable name', async () => {
    const { uninstall } = await import('../../src/package-manager/deno')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await uninstall('tool-bin')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['deno', 'uninstall', '--global', 'tool-bin'], expect.any(Object))
  })
})
