import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseBrewInstalledVersion } from '../../src/package-manager/brew'

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

function createListProc(exitCode: number, stdout: string, stderr = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stderr,
    stdout,
  }
}

describe('brew install', () => {
  it('installs formulas without a cask flag', async () => {
    const { install } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('example-formula')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['brew', 'install', 'example-formula'], expect.any(Object))
  })

  it('installs casks with --cask', async () => {
    const { install } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('example-cask', 'cask')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['brew', 'install', '--cask', 'example-cask'], expect.any(Object))
  })
})

describe('probePackagePresence', () => {
  it('returns present when brew list reports an installed formula version', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createListProc(0, 'example-formula 1.2.3\n'))

    expect(await probePackagePresence('example-formula')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(
      ['brew', 'list', '--formula', '--versions', 'example-formula'],
      expect.any(Object),
    )
  })

  it('lists casks with --cask', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createListProc(0, 'example-cask 9.8.7\n'))

    expect(await probePackagePresence('example-cask', 'cask')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(['brew', 'list', '--cask', '--versions', 'example-cask'], expect.any(Object))
  })

  it('returns absent when brew reports the package is missing', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createListProc(1, '', 'Error: No such keg: /opt/homebrew/Cellar/example-formula\n'))

    expect(await probePackagePresence('example-formula')).toBe('absent')
  })

  it('returns absent when brew reports the package is not installed', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createListProc(1, '', 'Error: example-cask is not installed\n'))

    expect(await probePackagePresence('example-cask', 'cask')).toBe('absent')
  })

  it('returns unknown when brew exits non-zero without a missing-package message', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createListProc(1, '', 'Error: Unexpected brew failure\n'))

    expect(await probePackagePresence('example-formula')).toBe('unknown')
  })

  it('returns present without a version when brew succeeds with unparseable output', async () => {
    const { probePackagePresence, getInstalledVersion } = await import('../../src/package-manager/brew')
    mockSpawn.mockReturnValue(createListProc(0, 'example-formula\n'))

    expect(await probePackagePresence('example-formula')).toBe('present')
    expect(await getInstalledVersion('example-formula')).toBeUndefined()
  })
})

describe('parseBrewInstalledVersion', () => {
  it('extracts the trailing version token', () => {
    expect(parseBrewInstalledVersion('example-formula 1.2.3\n')).toBe('1.2.3')
    expect(parseBrewInstalledVersion('homebrew/core/ripgrep 14.1.0\n')).toBe('14.1.0')
  })

  it('returns undefined for empty or unparseable output', () => {
    expect(parseBrewInstalledVersion('')).toBeUndefined()
    expect(parseBrewInstalledVersion('example-formula\n')).toBeUndefined()
    expect(parseBrewInstalledVersion('example-formula latest\n')).toBeUndefined()
  })
})
