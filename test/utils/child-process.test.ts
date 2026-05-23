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
    expect(mockSpawn).toHaveBeenCalledWith(
      ['npm', '--version'],
      expect.objectContaining({
        stdio: ['inherit', 'inherit', 'inherit'],
      }),
    )
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
    expect(mockSpawn).toHaveBeenCalledWith(
      ['npm', '--version'],
      expect.objectContaining({
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )
    expect(stderrWriteSpy).toHaveBeenCalledWith('installer stdout')
    expect(stderrWriteSpy).toHaveBeenCalledWith('installer stderr')
  })

  it('kills registered child processes when the cli context is cancelled', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'json-run-id',
    })
    const kill = vi.fn()
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(),
      exitCode: null,
      kill,
      stderr: '',
      stdout: '',
    })

    spawnWithQuantexStdio(['npm', '--version'])
    await cancelCliContextOperations()

    expect(kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('does not report success when a managed child exits zero after cancellation', async () => {
    setCliContext({
      interactive: false,
      outputMode: 'json',
      runId: 'json-run-id',
    })
    const kill = vi.fn()
    let resolveExit!: () => void
    mockSpawn.mockReturnValue({
      exited: new Promise<void>(resolve => {
        resolveExit = resolve
      }),
      exitCode: null,
      kill,
      stderr: '',
      stdout: '',
    })

    const handle = spawnWithQuantexStdio(['cargo', 'install', 'vtcode'])
    const cancellation = cancelCliContextOperations()
    await new Promise(resolve => setTimeout(resolve, 0))
    mockSpawn.mock.results[0]!.value.exitCode = 0
    resolveExit()
    await cancellation

    const exitCode = await waitForSpawnedCommand(handle)

    expect(exitCode).toBe(1)
    expect(kill).toHaveBeenCalledWith('SIGTERM')
  })
})
