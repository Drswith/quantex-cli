import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.hoisted(() => vi.fn())
let originalSpawn: typeof Bun.spawn

vi.mock('cross-spawn', async () => {
  const { createCrossSpawnMock } = await import('../helpers/cross-spawn-mock')
  return { default: createCrossSpawnMock(mockSpawn) }
})

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
    stderr: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
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

describe('isUvAvailable', () => {
  it('returns true when spawn succeeds', async () => {
    const { isUvAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(0))
    expect(await isUvAvailable()).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['uv', '--version'], expect.any(Object))
  })

  it('returns false when spawn throws', async () => {
    const { isUvAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(await isUvAvailable()).toBe(false)
  })
})

describe('isDenoAvailable', () => {
  it('returns true when spawn succeeds', async () => {
    const { isDenoAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(0))
    expect(await isDenoAvailable()).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['deno', '--version'], expect.any(Object))
  })

  it('returns false when spawn throws', async () => {
    const { isDenoAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(await isDenoAvailable()).toBe(false)
  })
})

describe('isMiseAvailable', () => {
  it('returns true when spawn succeeds', async () => {
    const { isMiseAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockReturnValue(createMockProcess(0))
    expect(await isMiseAvailable()).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith(['mise', '--version'], expect.any(Object))
  })

  it('returns false when spawn throws', async () => {
    const { isMiseAvailable } = await import('../../src/utils/detect')
    mockSpawn.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(await isMiseAvailable()).toBe(false)
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
