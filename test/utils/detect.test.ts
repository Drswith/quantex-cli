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

function createMockProcess(exitCode: number, stdout = '') {
  return {
    exited: Promise.resolve(),
    exitCode,
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout))
        controller.close()
      },
    }),
    stderr: new ReadableStream(),
  }
}

describe('getPlatform', () => {
  it('returns one of windows | macos | linux', async () => {
    const { getPlatform } = await import('../../src/utils/detect')
    const platform = getPlatform()
    expect(['windows', 'macos', 'linux']).toContain(platform)
  })
})

describe('isBunAvailable', () => {
  it('returns true when spawn succeeds', async () => {
    const { isBunAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(0))
    expect(await isBunAvailable()).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['bun', '--version'], expect.any(Object))
  })

  it('returns false when spawn throws', async () => {
    const { isBunAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(await isBunAvailable()).toBe(false)
  })
})

describe('isNpmAvailable', () => {
  it('returns true when spawn succeeds', async () => {
    const { isNpmAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(0))
    expect(await isNpmAvailable()).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', '--version'], expect.any(Object))
  })

  it('returns false when spawn throws', async () => {
    const { isNpmAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(await isNpmAvailable()).toBe(false)
  })
})

describe('isBinaryInPath', () => {
  it('uses which on unix platforms', async () => {
    const { isBinaryInPath } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(0))
    await isBinaryInPath('test-binary')
    const cmd = mockSpawn.mock.calls[0][0][0]
    expect(['which', 'where']).toContain(cmd)
  })

  it('returns false when binary not found', async () => {
    const { isBinaryInPath } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(1))
    expect(await isBinaryInPath('missing-binary')).toBe(false)
  })
})
