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

describe('execCommand', () => {
  it('returns success true when exit code is 0', async () => {
    const { execCommand } = await import('../../src/utils/exec')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 0,
    })
    const result = await execCommand('echo', ['hello'])
    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
  })

  it('returns success false when exit code is non-zero', async () => {
    const { execCommand } = await import('../../src/utils/exec')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 1,
    })
    const result = await execCommand('false', [])
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('returns success false when spawn throws', async () => {
    const { execCommand } = await import('../../src/utils/exec')
    mockSpawn.mockImplementation(() => {
      throw new Error('command not found')
    })
    const result = await execCommand('bad-cmd', [])
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('passes correct command and args to spawn', async () => {
    const { execCommand } = await import('../../src/utils/exec')
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 0,
    })
    await execCommand('npm', ['install', '-g', 'pkg'])
    expect(mockSpawn).toHaveBeenCalledWith(['npm', 'install', '-g', 'pkg'], expect.any(Object))
  })
})
