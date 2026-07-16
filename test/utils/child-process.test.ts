import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import {
  readProcessOutputWithContext,
  spawnWithQuantexStdio,
  terminateWindowsProcessTree,
  waitForSpawnedCommand,
} from '../../src/utils/child-process'

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

describe('context-aware process observations', () => {
  it('escalates a timed-out observation from TERM to KILL', async () => {
    const signals: NodeJS.Signals[] = []
    const never = new Promise<number>(() => {})
    const proc = {
      exitCode: null,
      exited: never,
      kill: (signal: NodeJS.Signals) => {
        signals.push(signal)
        return true
      },
      stderr: null,
      stdout: null,
      unref: () => undefined,
    }

    await expect(
      readProcessOutputWithContext(proc, {
        signal: new AbortController().signal,
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ kind: 'timed-out', timeoutMs: 5 })
    expect(signals).toEqual(['SIGTERM', 'SIGKILL'])
  })

  it('kills a POSIX process group after its leader exits during the grace period', async () => {
    if (process.platform === 'win32') return
    let resolveExit!: (code: number) => void
    const processKillSpy = vi.spyOn(process, 'kill').mockImplementation(((pid, signal) => {
      if (pid === -42 && signal === 'SIGTERM') resolveExit(0)
      return true
    }) as typeof process.kill)
    const proc = {
      exitCode: null,
      exited: new Promise<number>(resolve => {
        resolveExit = resolve
      }),
      kill: vi.fn(),
      pid: 42,
      stderr: null,
      stdout: null,
      unref: () => undefined,
    }

    try {
      await expect(
        readProcessOutputWithContext(proc, {
          signal: new AbortController().signal,
          timeoutMs: 5,
        }),
      ).rejects.toMatchObject({ kind: 'timed-out', timeoutMs: 5 })
      expect(processKillSpy).toHaveBeenNthCalledWith(1, -42, 'SIGTERM')
      expect(processKillSpy).toHaveBeenNthCalledWith(2, -42, 'SIGKILL')
    } finally {
      processKillSpy.mockRestore()
    }
  })

  it('uses taskkill tree force flags for Windows cleanup', async () => {
    const calls: unknown[][] = []
    const spawnProcess = ((...args: unknown[]) => {
      calls.push(args)
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('close', 0))
      return child
    }) as unknown as typeof import('node:child_process').spawn

    await terminateWindowsProcessTree(42, spawnProcess)

    expect(calls).toEqual([
      ['taskkill.exe', ['/PID', '42', '/T', '/F'], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true }],
    ])
  })
})
