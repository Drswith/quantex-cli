import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'

const mockSpawn = jest.fn()
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
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'i', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await install('some-package')).toBe(false)
  })
})

describe('npm update', () => {
  it('returns true on success', async () => {
    const { update } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })
    expect(await update('some-package')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'update', '-g', 'some-package'], expect.any(Object))
  })

  it('returns false on failure', async () => {
    const { update } = await import('../../src/package-manager/npm')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })
    expect(await update('some-package')).toBe(false)
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
