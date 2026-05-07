import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn

function createProc(exitCode: number, stdout = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stdout,
  }
}

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
})

afterEach(() => {
  Bun.spawn = originalSpawn
  mockSpawn.mockClear()
})

describe('bun install', () => {
  it('returns true on success', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(0, ''))
    expect(await install('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'add', '-g', 'some-package'], expect.any(Object))
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'pm', '-g', 'untrusted'], expect.any(Object))
  })

  it('supports explicit tags and registries', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValueOnce(createProc(0)).mockReturnValueOnce(createProc(0, ''))
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

  it('trusts blocked postinstall packages after install', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, './node_modules/some-package @1.0.0\n » [postinstall]: node install.cjs\n'))
      .mockReturnValueOnce(createProc(0))

    expect(await install('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(3, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
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

  it('returns false when trust fails for a blocked package', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn
      .mockReturnValueOnce(createProc(0))
      .mockReturnValueOnce(createProc(0, './node_modules/some-package @1.0.0\n » [postinstall]: node install.cjs\n'))
      .mockReturnValueOnce(createProc(1))

    expect(await update('some-package')).toBe(false)
    expect(mockSpawn).toHaveBeenNthCalledWith(3, ['bun', 'pm', '-g', 'trust', 'some-package'], expect.any(Object))
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
})
