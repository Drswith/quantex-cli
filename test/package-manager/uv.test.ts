import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseToolListVersion } from '../../src/package-manager/uv'

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

describe('uv install', () => {
  it('returns true on success', async () => {
    const { install } = await import('../../src/package-manager/uv')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('some-tool')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['uv', 'tool', 'install', 'some-tool'], expect.any(Object))
  })

  it('passes uv tool install args after the package name', async () => {
    const { install } = await import('../../src/package-manager/uv')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await install('some-tool', ['--python', '3.12'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['uv', 'tool', 'install', 'some-tool', '--python', '3.12'],
      expect.any(Object),
    )
  })

  it('returns false on failure', async () => {
    const { install } = await import('../../src/package-manager/uv')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 1 })

    expect(await install('some-tool')).toBe(false)
  })
})

describe('uv update', () => {
  it('runs uv tool upgrade for the package', async () => {
    const { update } = await import('../../src/package-manager/uv')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await update('some-tool', ['--python', '3.12'])).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(
      ['uv', 'tool', 'upgrade', 'some-tool', '--python', '3.12'],
      expect.any(Object),
    )
  })
})

describe('uv updateMany', () => {
  it('updates tools sequentially', async () => {
    const { updateMany } = await import('../../src/package-manager/uv')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(
      await updateMany([
        { packageInstallArgs: ['--python', '3.12'], packageName: 'some-tool' },
        { packageName: 'other-tool' },
      ]),
    ).toBe(true)
    expect(mockSpawn).toHaveBeenNthCalledWith(
      1,
      ['uv', 'tool', 'upgrade', 'some-tool', '--python', '3.12'],
      expect.any(Object),
    )
    expect(mockSpawn).toHaveBeenNthCalledWith(2, ['uv', 'tool', 'upgrade', 'other-tool'], expect.any(Object))
  })
})

describe('uv uninstall', () => {
  it('returns true on success', async () => {
    const { uninstall } = await import('../../src/package-manager/uv')
    mockSpawn.mockReturnValue({ exited: Promise.resolve(), exitCode: 0 })

    expect(await uninstall('some-tool')).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['uv', 'tool', 'uninstall', 'some-tool'], expect.any(Object))
  })
})

describe('parseToolListVersion', () => {
  it('extracts a tool version from uv tool list output', () => {
    expect(parseToolListVersion('mistral-vibe v1.2.3\n- vibe\n', 'mistral-vibe')).toBe('1.2.3')
  })

  it('normalizes equivalent Python package separators', () => {
    expect(parseToolListVersion('mistral_vibe v1.2.3\n- vibe\n', 'mistral-vibe')).toBe('1.2.3')
  })

  it('returns undefined when the package is not present', () => {
    expect(parseToolListVersion('other-tool v1.2.3\n- other\n', 'mistral-vibe')).toBeUndefined()
  })
})
