import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import { spawnWithQuantexStdio, waitForSpawnedCommand } from '../../src/utils/child-process'

const mockSpawn = vi.fn()
let originalSpawn: typeof Bun.spawn

describe('spawnWithQuantexStdio', () => {
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalSpawn = Bun.spawn
    Bun.spawn = mockSpawn as any
    stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    Bun.spawn = originalSpawn
    stderrWriteSpy.mockRestore()
    mockSpawn.mockReset()
  })

  it('inherits stdio in human mode', async () => {
    setCliContext({
      interactive: true,
      outputMode: 'human',
      runId: 'human-run-id',
    })
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 0,
    })

    const handle = spawnWithQuantexStdio(['npm', '--version'])
    const exitCode = await waitForSpawnedCommand(handle)

    expect(exitCode).toBe(0)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({
      stdio: ['inherit', 'inherit', 'inherit'],
    }))
    expect(stderrWriteSpy).not.toHaveBeenCalled()
  })

  it('redirects child stdout and stderr to parent stderr in structured modes', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'json-run-id',
    })
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: 0,
      stderr: 'installer stderr',
      stdout: 'installer stdout',
    })

    const handle = spawnWithQuantexStdio(['npm', '--version'])
    const exitCode = await waitForSpawnedCommand(handle)

    expect(exitCode).toBe(0)
    expect(mockSpawn).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({
      stdio: ['ignore', 'pipe', 'pipe'],
    }))
    expect(stderrWriteSpy).toHaveBeenCalledWith('installer stdout')
    expect(stderrWriteSpy).toHaveBeenCalledWith('installer stderr')
  })

  it('kills registered child processes when the cli context is cancelled', () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'json-run-id',
    })
    const kill = vi.fn()
    mockSpawn.mockReturnValue({
      exited: new Promise(() => {}),
      exitCode: null,
      kill,
      stderr: '',
      stdout: '',
    })

    spawnWithQuantexStdio(['npm', '--version'])
    cancelCliContextOperations()

    expect(kill).toHaveBeenCalledWith('SIGTERM')
  })
})
