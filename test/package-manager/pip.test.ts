import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePipInstalledVersion } from '../../src/package-manager/pip'

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

function createShowProc(exitCode: number, stdout: string, stderr = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stderr,
    stdout,
  }
}

describe('probePackagePresence', () => {
  it('returns present when pip show reports the package', async () => {
    const { probePackagePresence, getInstalledVersion } = await import('../../src/package-manager/pip')
    mockSpawn.mockImplementation((command: string[]) => {
      if (command.includes('--version')) return createShowProc(0, 'pip 24.0\n')
      if (command.includes('show')) return createShowProc(0, 'Name: mistral-vibe\nVersion: 1.2.3\n')
      return createShowProc(1, '', 'unexpected')
    })

    expect(await probePackagePresence('mistral-vibe')).toBe('present')
    expect(await getInstalledVersion('mistral-vibe')).toBe('1.2.3')
    expect(mockSpawn.mock.calls.some(call => (call[0] as string[]).includes('show'))).toBe(true)
  })

  it('returns absent when pip reports the package is missing', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/pip')
    mockSpawn.mockImplementation((command: string[]) => {
      if (command.includes('--version')) return createShowProc(0, 'pip 24.0\n')
      if (command.includes('show')) return createShowProc(1, '', 'WARNING: Package(s) not found: missing-pkg\n')
      return createShowProc(1, '', 'unexpected')
    })

    expect(await probePackagePresence('missing-pkg')).toBe('absent')
  })

  it('returns unknown when pip show fails without a missing-package message', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/pip')
    mockSpawn.mockImplementation((command: string[]) => {
      if (command.includes('--version')) return createShowProc(0, 'pip 24.0\n')
      if (command.includes('show')) return createShowProc(2, '', 'error: unexpected pip failure\n')
      return createShowProc(1, '', 'unexpected')
    })

    expect(await probePackagePresence('mistral-vibe')).toBe('unknown')
  })
})

describe('parsePipInstalledVersion', () => {
  it('extracts the Version field', () => {
    expect(parsePipInstalledVersion('Name: mistral-vibe\nVersion: 1.2.3\n')).toBe('1.2.3')
    expect(parsePipInstalledVersion('Name: mistral-vibe\n')).toBeUndefined()
  })
})
