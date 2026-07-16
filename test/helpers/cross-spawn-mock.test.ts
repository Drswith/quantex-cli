import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createCrossSpawnMock } from './cross-spawn-mock'

describe('createCrossSpawnMock', () => {
  it('adapts Bun-style argv and completion to the Node child-process contract', async () => {
    const bunSpawn = vi.fn().mockReturnValue({
      exitCode: 0,
      exited: Promise.resolve(),
      pid: 42,
      stderr: undefined,
      stdout: 'ok',
    })
    const spawn = createCrossSpawnMock(bunSpawn)

    const child = spawn('npm', ['--version'], { cwd: 'workspace' })
    const [exitCode] = await once(child, 'close')

    expect(bunSpawn).toHaveBeenCalledWith(['npm', '--version'], { cwd: 'workspace' })
    expect(child.exitCode).toBe(0)
    expect(child.pid).toBe(42)
    expect(child.stdout).toBe('ok')
    expect(exitCode).toBe(0)
  })
})
