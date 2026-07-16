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

describe('npm install', () => {
  it('returns true on success', async () => {
    const { install } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await install('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'install', '-g', 'some-package'], expect.any(Object))
  })

  it('supports explicit tags and registries', async () => {
    const { install } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await install('some-package', 'latest', 'https://registry.npmjs.org/')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['npm', 'install', '-g', 'some-package@latest', '--registry', 'https://registry.npmjs.org'],
      expect.any(Object),
    )
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await install('some-package')).toBe(false)
  })
})

describe('npm update', () => {
  it('uses latest-major strategy by default', async () => {
    const { update } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await update('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'install', '-g', 'some-package@latest'], expect.any(Object))
  })

  it('supports respect-semver strategy', async () => {
    const { update } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await update('some-package', 'respect-semver')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'update', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { update } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await update('some-package')).toBe(false)
  })
})

describe('npm updateMany', () => {
  it('uses latest-major strategy by default', async () => {
    const { updateMany } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await updateMany(['some-package', 'other-package'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['npm', 'install', '-g', 'some-package@latest', 'other-package@latest'],
      expect.any(Object),
    )
  })

  it('supports respect-semver strategy', async () => {
    const { updateMany } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await updateMany(['some-package', 'other-package'], 'respect-semver')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'update', '-g', 'some-package', 'other-package'], expect.any(Object))
  })
})

describe('npm uninstall', () => {
  it('returns true on success', async () => {
    const { uninstall } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await uninstall('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'uninstall', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { uninstall } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await uninstall('some-package')).toBe(false)
  })
})

function createListProc(exitCode: number, stdout: string) {
  return {
    exited: Promise.resolve(),
    exitCode,
    stdout,
  }
}

describe('parseGlobalPackageVersion', () => {
  it('parses scoped and unscoped packages from npm global list JSON', async () => {
    const { parseGlobalPackageVersion } = await import('../../src/package-manager/npm')
    const output = JSON.stringify({
      dependencies: {
        'test-pkg': { version: '1.2.3' },
        '@scope/name': { version: '4.5.6' },
      },
    })

    expect(parseGlobalPackageVersion(output, 'test-pkg')).toBe('1.2.3')
    expect(parseGlobalPackageVersion(output, '@scope/name')).toBe('4.5.6')
    expect(parseGlobalPackageVersion(output, 'missing-package')).toBeUndefined()
  })
})

describe('probePackagePresence', () => {
  it('returns present when scoped npm list JSON includes the package', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(
      createListProc(
        1,
        JSON.stringify({
          dependencies: {
            'test-pkg': { version: '1.2.3' },
          },
        }),
      ),
    )

    expect(await probePackagePresence('test-pkg')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'list', '-g', 'test-pkg', '--depth=0', '--json'], expect.any(Object))
  })

  it('returns absent when scoped npm list JSON omits the package', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(
      createListProc(
        1,
        JSON.stringify({
          dependencies: {},
        }),
      ),
    )

    expect(await probePackagePresence('test-pkg')).toBe('absent')
  })

  it('returns present when the package entry exists without a readable version', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(
      createListProc(
        1,
        JSON.stringify({
          dependencies: {
            'test-pkg': { invalid: true },
          },
        }),
      ),
    )

    expect(await probePackagePresence('test-pkg')).toBe('present')
  })

  it('returns unknown when npm reports a structured error', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(
      createListProc(
        1,
        JSON.stringify({
          error: {
            code: 'EJSONPARSE',
            summary: 'Invalid package metadata',
          },
        }),
      ),
    )

    expect(await probePackagePresence('test-pkg')).toBe('unknown')
  })

  it('returns unknown when npm list output is empty', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(createListProc(1, ''))

    expect(await probePackagePresence('test-pkg')).toBe('unknown')
  })

  it('returns unknown when npm list output is not valid JSON', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(createListProc(1, 'npm ERR! broken'))

    expect(await probePackagePresence('test-pkg')).toBe('unknown')
  })
})

describe('getInstalledVersion', () => {
  it('returns the version when scoped npm list JSON includes the package', async () => {
    const { getInstalledVersion } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue(
      createListProc(
        1,
        JSON.stringify({
          dependencies: {
            'test-pkg': { version: '2.0.0' },
          },
        }),
      ),
    )

    expect(await getInstalledVersion('test-pkg')).toBe('2.0.0')
  })
})
