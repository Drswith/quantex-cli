import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn

beforeEach(() => {
  originalSpawn = Bun.spawn
  Bun.spawn = mockSpawn as any
})

afterEach(() => {
  Bun.spawn = originalSpawn
  mockSpawn.mockClear()
})

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
