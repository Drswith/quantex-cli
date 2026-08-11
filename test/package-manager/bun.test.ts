import { access, mkdir, mkdtemp, readlink, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSpawn, mutationRun } = vi.hoisted(() => ({ mockSpawn: vi.fn(), mutationRun: vi.fn() }))

vi.mock('../../src/utils/child-process', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/utils/child-process')>()
  return {
    ...actual,
    spawnCommand: (command: readonly string[], options: unknown) => {
      const proc = mockSpawn(command, options)
      return {
        ...proc,
        exited: Promise.resolve(proc.exitCode),
        kill: () => true,
        unref: () => undefined,
      }
    },
  }
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

function createProc(exitCode: number, stdout = '', stderr = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stderr,
    stdout,
  }
}

beforeEach(() => {
  mutationRun.mockImplementation(runMutation)
})

afterEach(() => {
  mockSpawn.mockReset()
  mutationRun.mockReset()
  vi.unstubAllEnvs()
})

async function runMutation(command: readonly string[], _context: unknown, description: string) {
  const proc = mockSpawn(command, { detached: process.platform !== 'win32' })
  await proc.exited
  return proc.exitCode === 0
    ? { kind: 'success', value: undefined }
    : { command, exitCode: proc.exitCode, kind: 'failed', reason: description, retryable: false }
}

describe('bun install', () => {
  it('returns true on success', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0, '', 'No package.json was found for directory'))
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, ''))
    expect(await install('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'pm', '-g', 'ls'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'add', '-g', 'some-package'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'pm', '-g', 'untrusted'], expect.any(Object))
  })

  it('supports explicit tags and registries', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0, '', 'No package.json was found for directory'))
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, ''))
    expect(await install('some-package', 'latest', 'https://registry.npmjs.org/')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['bun', 'add', '-g', '--registry', 'https://registry.npmjs.org', 'some-package@latest'],
      expect.any(Object),
    )
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1))
    expect(await install('some-package')).toBe(false)
  })

  it('returns false when the untrusted probe fails after install', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0, '', 'No package.json was found for directory'))
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(1))
      .mockReturnValueOnce(createProc(0))

    expect(await install('some-package')).toBe(false)
    expect(mockSpawn).toHaveBeenNthCalledWith(1, ['bun', 'pm', '-g', 'ls'], expect.any(Object))
    expect(mockSpawn).toHaveBeenNthCalledWith(3, ['bun', 'pm', '-g', 'untrusted'], expect.any(Object))
    expect(mockSpawn).toHaveBeenNthCalledWith(4, ['bun', 'remove', '-g', 'some-package'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledTimes(4)
  })

  it('trusts blocked postinstall packages after install', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0, '', 'No package.json was found for directory'))
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, './node_modules/some-package @1.0.0\n » [postinstall]: node install.cjs\n'))
      .mockReturnValueOnce(createProc(0))

    expect(await install('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(4, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
  })

  it('returns the typed trust failure and compensates only a newly added package', async () => {
    const { installOutcome } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0, '', 'No package.json was found for directory'))
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, './node_modules/some-package @1.0.0\n » [postinstall]: node install.cjs\n'))
      .mockReturnValueOnce(createProc(1))
      .mockReturnValueOnce(createProc(0))

    expect(
      await installOutcome('some-package', undefined, undefined, {
        signal: new AbortController().signal,
        timeoutMs: 5_000,
      }),
    ).toEqual({
      command: ['bun', 'pm', '-g', 'trust', 'some-package'],
      exitCode: 1,
      kind: 'failed',
      reason: 'bun trust failed',
      retryable: false,
    })
    expect(mockSpawn).toHaveBeenNthCalledWith(4, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
    expect(mockSpawn).toHaveBeenNthCalledWith(5, ['bun', 'remove', '-g', 'some-package'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledTimes(5)
  })

  it('returns the typed trust failure without compensating a pre-existing package', async () => {
    const { installOutcome } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0, '├── some-package@1.0.0\n'))
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, './node_modules/some-package @1.0.0\n » [postinstall]: node install.cjs\n'))
      .mockReturnValueOnce(createProc(1))

    expect(
      await installOutcome('some-package', undefined, undefined, {
        signal: new AbortController().signal,
        timeoutMs: 5_000,
      }),
    ).toEqual({
      command: ['bun', 'pm', '-g', 'trust', 'some-package'],
      exitCode: 1,
      kind: 'failed',
      reason: 'bun trust failed',
      retryable: false,
    })
    expect(mockSpawn).toHaveBeenNthCalledWith(4, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
    expect(mockSpawn.mock.calls.some(([command]) => command[1] === 'remove')).toBe(false)
    expect(mockSpawn).toHaveBeenCalledTimes(4)
  })
})

describe('bun update', () => {
  it('uses latest-major strategy by default', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(0, ''))
    expect(await update('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', '--latest', 'some-package'], expect.any(Object))
  })

  it('supports respect-semver strategy', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(0, ''))
    expect(await update('some-package', 'respect-semver')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1))
    expect(await update('some-package')).toBe(false)
  })

  it('returns false when the untrusted probe fails after update', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(1))

    expect(await update('some-package')).toBe(false)
    expect(mockSpawn).toHaveBeenNthCalledWith(2, ['bun', 'pm', '-g', 'untrusted'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledTimes(2)
  })

  it('returns false when trust fails for a blocked package', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, './node_modules/some-package @1.0.0\n » [postinstall]: node install.cjs\n'))
      .mockReturnValueOnce(createProc(1))

    expect(await update('some-package')).toBe(false)
    expect(mockSpawn).toHaveBeenNthCalledWith(3, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledTimes(3)
  })
})

describe('bun updateMany', () => {
  it('uses latest-major strategy by default', async () => {
    const { updateMany } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(0, ''))
    expect(await updateMany(['some-package', 'other-package'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['bun', 'update', '-g', '--latest', 'some-package', 'other-package'],
      expect.any(Object),
    )
  })

  it('supports respect-semver strategy', async () => {
    const { updateMany } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(0, ''))
    expect(await updateMany(['some-package', 'other-package'], 'respect-semver')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', 'some-package', 'other-package'], expect.any(Object))
  })

  it('trusts only blocked packages from the current batch', async () => {
    const { updateMany } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(
        createProc(
          0,
          [
            './node_modules/some-package @1.0.0',
            ' » [postinstall]: node install.cjs',
            './node_modules/unrelated-package @1.0.0',
            ' » [postinstall]: node scripts/postinstall.js',
          ].join('\n'),
        ),
      )
      .mockReturnValueOnce(createProc(0))

    expect(await updateMany(['some-package', 'other-package'])).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(3, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
  })

  it('trusts requested scoped packages from Windows untrusted output', async () => {
    const { updateMany } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(
        createProc(
          0,
          [
            '.\\node_modules\\@anthropic-ai\\claude-code @2.1.132',
            ' » [postinstall]: node install.cjs',
            '.\\node_modules\\unrelated-package @1.0.0',
            ' » [postinstall]: node scripts/postinstall.js',
          ].join('\n'),
        ),
      )
      .mockReturnValueOnce(createProc(0))

    expect(await updateMany(['@anthropic-ai/claude-code', 'other-package'])).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(
      3,
      ['bun', 'pm', '-g', 'trust', '@anthropic-ai/claude-code'],
      expect.any(Object),
    )
  })
})

describe('parseUntrustedPackages', () => {
  it('parses scoped package names from POSIX and Windows node_modules paths', async () => {
    const { parseUntrustedPackages } = await import('../../src/package-manager/bun')

    expect(
      parseUntrustedPackages(
        [
          './node_modules/some-package @1.0.0',
          '.\\node_modules\\@anthropic-ai\\claude-code @2.1.132',
          '.\\node_modules\\@scope\\nested-name @3.0.0',
        ].join('\n'),
      ),
    ).toEqual(new Set(['some-package', '@anthropic-ai/claude-code', '@scope/nested-name']))
  })
})

describe('parseGlobalPackageVersion', () => {
  it('parses scoped and unscoped packages from Bun global list output', async () => {
    const { parseGlobalPackageVersion } = await import('../../src/package-manager/bun')
    const output = [
      '/Users/test/.bun/install/global node_modules (534)',
      '├── @github/copilot@1.0.43',
      '├── @mariozechner/pi-coding-agent@0.73.1',
      '└── quantex-cli@0.16.2',
    ].join('\n')

    expect(parseGlobalPackageVersion(output, '@github/copilot')).toBe('1.0.43')
    expect(parseGlobalPackageVersion(output, '@mariozechner/pi-coding-agent')).toBe('0.73.1')
    expect(parseGlobalPackageVersion(output, 'quantex-cli')).toBe('0.16.2')
    expect(parseGlobalPackageVersion(output, 'missing-package')).toBeUndefined()
  })
})

describe('probePackagePresence', () => {
  it('returns present when bun global list output includes the package', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, ['├── test-pkg@1.2.3', '└── other-pkg@2.0.0'].join('\n')))

    expect(await probePackagePresence('test-pkg')).toBe('present')
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'pm', '-g', 'ls'], expect.any(Object))
  })

  it('returns absent when bun global list output omits the package', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, '└── other-pkg@2.0.0'))

    expect(await probePackagePresence('test-pkg')).toBe('absent')
  })

  it('returns present when the package entry exists without a readable version', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, '└── test-pkg@'))

    expect(await probePackagePresence('test-pkg')).toBe('present')
  })

  it('returns unknown when bun global list output is empty', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, ''))

    expect(await probePackagePresence('test-pkg')).toBe('unknown')
  })

  it('returns absent when Bun reports an uninitialized empty global package root', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(
      createProc(
        1,
        '',
        'error: No package.json was found for directory "/root/.bun/install/global"\nnote: Run "bun init" to initialize a project\n',
      ),
    )

    expect(await probePackagePresence('test-pkg')).toBe('absent')
  })

  it('uses an empty global manifest to classify Bun missing-lockfile output as absent', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, '', 'error: Lockfile not found\n'))

    expect(
      await probePackagePresence('test-pkg', {
        readGlobalManifest: async () => '{}',
      }),
    ).toBe('absent')
  })

  it('fails closed when a missing-lockfile manifest still records the package', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, '', 'error: Lockfile not found\n'))

    expect(
      await probePackagePresence('test-pkg', {
        readGlobalManifest: async () => JSON.stringify({ dependencies: { 'test-pkg': '^1.0.0' } }),
      }),
    ).toBe('present')
  })

  it('fails closed when a missing-lockfile manifest has a malformed dependency map', async () => {
    const { probePackagePresence } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1, '', 'error: Lockfile not found\n'))

    expect(
      await probePackagePresence('test-pkg', {
        readGlobalManifest: async () => JSON.stringify({ dependencies: [] }),
      }),
    ).toBe('unknown')
  })
})

describe('bun uninstall', () => {
  it('returns true on success', async () => {
    const { uninstall } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(0))
    expect(await uninstall('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'remove', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { uninstall } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue(createProc(1))
    expect(await uninstall('some-package')).toBe(false)
  })

  it('removes an unchanged stale global-bin link owned by the removed package', async () => {
    if (process.platform === 'win32') return

    const sandbox = await createOwnedBinaryLinkSandbox()
    try {
      vi.stubEnv('BUN_INSTALL_GLOBAL_DIR', sandbox.globalDirectory)
      mockSpawn
        .mockReturnValueOnce(createProc(0, `${sandbox.binDirectory}\n`))
        .mockReturnValueOnce(createProc(0))
        .mockReturnValueOnce(createProc(1, '', 'error: Lockfile not found\n'))

      const { uninstallOutcome } = await import('../../src/package-manager/bun')
      await expect(
        uninstallOutcome('@example/agent', { signal: new AbortController().signal, timeoutMs: 5_000 }, 'agent'),
      ).resolves.toEqual({ kind: 'success', value: undefined })

      await expect(access(sandbox.linkPath)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(access(sandbox.targetPath)).resolves.toBeUndefined()
      expect(mockSpawn).toHaveBeenNthCalledWith(1, ['bun', 'pm', 'bin', '-g'], expect.any(Object))
      expect(mockSpawn).toHaveBeenNthCalledWith(2, ['bun', 'remove', '-g', '@example/agent'], expect.any(Object))
      expect(mockSpawn).toHaveBeenNthCalledWith(3, ['bun', 'pm', '-g', 'ls'], expect.any(Object))
    } finally {
      await rm(sandbox.root, { force: true, recursive: true })
    }
  })

  it('preserves a global-bin link that changes during package removal', async () => {
    if (process.platform === 'win32') return

    const sandbox = await createOwnedBinaryLinkSandbox()
    const replacementTarget = join(sandbox.globalDirectory, 'node_modules', '@other', 'agent', 'agent')
    try {
      await mkdir(dirname(replacementTarget), { recursive: true })
      await writeFile(replacementTarget, '#!/bin/sh\n')
      vi.stubEnv('BUN_INSTALL_GLOBAL_DIR', sandbox.globalDirectory)
      mockSpawn
        .mockReturnValueOnce(createProc(0, `${sandbox.binDirectory}\n`))
        .mockReturnValueOnce(createProc(1, '', 'error: Lockfile not found\n'))
      mutationRun.mockImplementationOnce(async () => {
        await unlink(sandbox.linkPath)
        await symlink(replacementTarget, sandbox.linkPath)
        return { kind: 'success', value: undefined }
      })

      const { uninstallOutcome } = await import('../../src/package-manager/bun')
      await uninstallOutcome('@example/agent', { signal: new AbortController().signal }, 'agent')

      await expect(readlink(sandbox.linkPath)).resolves.toBe(replacementTarget)
    } finally {
      await rm(sandbox.root, { force: true, recursive: true })
    }
  })
})

async function createOwnedBinaryLinkSandbox() {
  const root = await mkdtemp(join(tmpdir(), 'qtx-bun-uninstall-'))
  const globalDirectory = join(root, 'global')
  const binDirectory = join(root, 'bin')
  const packageDirectory = join(globalDirectory, 'node_modules', '@example', 'agent')
  const dependencyDirectory = join(globalDirectory, 'node_modules', '@example', 'agent-linux-x64')
  const targetPath = join(dependencyDirectory, 'agent')
  const linkPath = join(binDirectory, 'agent')
  await mkdir(packageDirectory, { recursive: true })
  await mkdir(dependencyDirectory, { recursive: true })
  await mkdir(binDirectory, { recursive: true })
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({
      bin: { agent: 'bin/agent' },
      optionalDependencies: { '@example/agent-linux-x64': '1.0.0' },
    }),
  )
  await writeFile(join(globalDirectory, 'package.json'), '{}')
  await writeFile(targetPath, '#!/bin/sh\n')
  await symlink(targetPath, linkPath)
  return { binDirectory, globalDirectory, linkPath, root, targetPath }
}
