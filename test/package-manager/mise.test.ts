import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseMiseInstalledVersion } from '../../src/package-manager/mise'

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

describe('mise install', () => {
  it('runs mise use against global config', async () => {
    const { install } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('npm:@openai/codex')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['mise', 'use', '--global', 'npm:@openai/codex'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })

    expect(await install('npm:@openai/codex')).toBe(false)
  })
})

describe('mise update', () => {
  it('forces a global mise use for the recorded tool ref', async () => {
    const { update } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await update('npm:@openai/codex')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['mise', 'use', '--global', '--force', 'npm:@openai/codex'],
      expect.any(Object),
    )
  })
})

describe('mise updateMany', () => {
  it('updates tool refs sequentially', async () => {
    const { updateMany } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(
      await updateMany([{ packageName: 'npm:@openai/codex' }, { packageName: 'npm:@anthropic-ai/claude-code' }]),
    ).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(
      1,
      ['mise', 'use', '--global', '--force', 'npm:@openai/codex'],
      expect.any(Object),
    )
    expect(mockSpawn).toHaveBeenNthCalledWith(
      2,
      ['mise', 'use', '--global', '--force', 'npm:@anthropic-ai/claude-code'],
      expect.any(Object),
    )
  })
})

describe('mise uninstall', () => {
  it('removes the global mise tool ref', async () => {
    const { uninstall } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await uninstall('npm:@openai/codex')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['mise', 'unuse', '--global', 'npm:@openai/codex'], expect.any(Object))
  })
})

describe('probePackagePresence', () => {
  it('returns present when scoped mise ls json includes the tool', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 1,
      stdout: JSON.stringify({
        'npm:@openai/codex': [{ active: true, version: '0.26.0' }],
      }),
    })

    expect(await probePackagePresence('npm:@openai/codex')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(
      ['mise', 'ls', '--installed', '--json', 'npm:@openai/codex'],
      expect.any(Object),
    )
  })

  it('returns absent when scoped mise ls json omits the tool', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 0,
      stdout: JSON.stringify({}),
    })

    expect(await probePackagePresence('npm:@openai/codex')).toBe('absent')
  })

  it('returns unknown when mise ls output is empty', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 1,
      stdout: '',
    })

    expect(await probePackagePresence('npm:@openai/codex')).toBe('unknown')
  })

  it('returns unknown when mise ls output is not valid JSON', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/mise')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 1,
      stdout: 'mise error: broken',
    })

    expect(await probePackagePresence('npm:@openai/codex')).toBe('unknown')
  })
})

describe('parseMiseInstalledVersion', () => {
  it('extracts a version from mise ls json output', () => {
    expect(
      parseMiseInstalledVersion(
        JSON.stringify({
          'npm:@openai/codex': [{ active: true, version: '0.26.0' }],
        }),
        'npm:@openai/codex',
      ),
    ).toBe('0.26.0')
  })

  it('accepts a single returned tool entry when mise normalizes the key', () => {
    expect(
      parseMiseInstalledVersion(
        JSON.stringify({
          codex: [{ active: true, version: '0.27.0' }],
        }),
        'npm:@openai/codex',
      ),
    ).toBe('0.27.0')
  })

  it('returns undefined for unknown tools or shapes', () => {
    expect(parseMiseInstalledVersion('{"node":[{"version":"24.0.0"}]}', 'npm:@openai/codex')).toBeUndefined()
    expect(parseMiseInstalledVersion('not-json', 'npm:@openai/codex')).toBeUndefined()
  })
})
