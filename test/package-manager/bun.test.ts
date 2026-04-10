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

describe('bun install', () => {
  it('returns true on success', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await install('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'add', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await install('some-package')).toBe(false)
  })
})

describe('bun update', () => {
  it('uses latest-major strategy by default', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await update('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', '--latest', 'some-package'], expect.any(Object))
  })

  it('supports respect-semver strategy', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await update('some-package', 'respect-semver')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { update } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await update('some-package')).toBe(false)
  })
})

describe('bun updateMany', () => {
  it('uses latest-major strategy by default', async () => {
    const { updateMany } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await updateMany(['some-package', 'other-package'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', '--latest', 'some-package', 'other-package'], expect.any(Object))
  })

  it('supports respect-semver strategy', async () => {
    const { updateMany } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await updateMany(['some-package', 'other-package'], 'respect-semver')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'update', '-g', 'some-package', 'other-package'], expect.any(Object))
  })
})

describe('bun uninstall', () => {
  it('returns true on success', async () => {
    const { uninstall } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await uninstall('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', 'remove', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { uninstall } = await import('../../src/package-manager/bun')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await uninstall('some-package')).toBe(false)
  })
})
