import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWingetInstalledVersion } from '../../src/package-manager/winget'

const mockSpawn = vi.hoisted(() => vi.fn())
const mutationRun = vi.hoisted(() => vi.fn())
let originalSpawn: typeof Bun.spawn

vi.mock('cross-spawn', async () => {
  const { createCrossSpawnMock } = await import('../helpers/cross-spawn-mock')
  return { default: createCrossSpawnMock(mockSpawn) }
})

vi.mock('../../src/package-manager/context-mutation', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/package-manager/context-mutation')>()
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

describe('probePackagePresence', () => {
  it('returns present when winget list reports the package id', async () => {
    const { probePackagePresence, getInstalledVersion } = await import('../../src/package-manager/winget')
    mockSpawn.mockReturnValue(
      createListProc(
        0,
        'Name                   Id              Version\n------------------------------------------------\nGitHub Copilot CLI     GitHub.Copilot   1.2.3\n',
      ),
    )

    expect(await probePackagePresence('GitHub.Copilot')).toBe('present')
    expect(await getInstalledVersion('GitHub.Copilot')).toBe('1.2.3')
    expect(mockSpawn).toHaveBeenCalledWith(['winget', 'list', '--id', 'GitHub.Copilot', '-e'], expect.any(Object))
  })

  it('returns absent when winget reports no matching installed package', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/winget')
    mockSpawn.mockReturnValue(createListProc(1, '', 'No installed package found matching input criteria.\n'))

    expect(await probePackagePresence('GitHub.Copilot')).toBe('absent')
  })

  it('returns unknown when winget exits non-zero without a missing-package message', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/winget')
    mockSpawn.mockReturnValue(createListProc(1, '', 'Error: unexpected winget failure\n'))

    expect(await probePackagePresence('GitHub.Copilot')).toBe('unknown')
  })
})

describe('parseWingetInstalledVersion', () => {
  it('extracts the version column after the package id', () => {
    expect(
      parseWingetInstalledVersion(
        'Name                   Id              Version\n------------------------------------------------\nGitHub Copilot CLI     GitHub.Copilot   1.2.3\n',
        'GitHub.Copilot',
      ),
    ).toBe('1.2.3')
    expect(parseWingetInstalledVersion('Name Id Version\n', 'GitHub.Copilot')).toBeUndefined()
  })
})
