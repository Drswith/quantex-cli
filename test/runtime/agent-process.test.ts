import type { SpawnedProcessHandle } from '../../src/utils/child-process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgentProcessPort } from '../../src/runtime/agent-process'

afterEach(() => {
  vi.useRealTimers()
})

describe('createAgentProcessPort', () => {
  it('spawns a Unix process group with inherited stdio and preserves a normal exit code', async () => {
    const handle = completedHandle(42)
    const spawn = vi.fn(() => handle)
    const port = createAgentProcessPort({ platform: 'linux', spawn, terminate: vi.fn(), writeStderr: vi.fn() })

    await expect(
      port.run({
        argv: ['test-bin', '--help'],
        signal: new AbortController().signal,
        stdio: ['inherit', 'inherit', 'inherit'],
      }),
    ).resolves.toEqual({ kind: 'success', value: { exitCode: 42 } })
    expect(spawn).toHaveBeenCalledWith(['test-bin', '--help'], {
      detached: true,
      stdio: ['inherit', 'inherit', 'inherit'],
    })
  })

  it('forwards captured structured output to stderr and returns the bytes', async () => {
    const writeStderr = vi.fn()
    const port = createAgentProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => completedHandle(0, 'child stdout', 'child stderr')),
      terminate: vi.fn(),
      writeStderr,
    })

    const outcome = await port.run({
      argv: ['test-bin'],
      signal: new AbortController().signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    expect(outcome).toEqual({
      kind: 'success',
      value: {
        exitCode: 0,
        stderr: new TextEncoder().encode('child stderr'),
        stdout: new TextEncoder().encode('child stdout'),
      },
    })
    expect(writeStderr.mock.calls.map(([value]) => value)).toEqual(['child stdout', 'child stderr'])
  })

  it('returns a typed launch failure when spawn throws', async () => {
    const port = createAgentProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => {
        throw new Error('spawn exploded')
      }),
      terminate: vi.fn(),
      writeStderr: vi.fn(),
    })

    await expect(port.run({ argv: ['missing-bin'], signal: new AbortController().signal })).resolves.toEqual({
      error: { kind: 'failed', message: 'spawn exploded' },
      kind: 'failure',
    })
  })

  it('does not spawn when the invocation is already cancelled', async () => {
    const controller = new AbortController()
    controller.abort('cancelled before launch')
    const spawn = vi.fn(() => completedHandle(0))
    const port = createAgentProcessPort({ platform: 'linux', spawn, terminate: vi.fn(), writeStderr: vi.fn() })

    await expect(port.run({ argv: ['test-bin'], signal: controller.signal })).resolves.toEqual({
      error: { kind: 'cancelled', message: 'cancelled before launch' },
      kind: 'failure',
    })
    expect(spawn).not.toHaveBeenCalled()
  })

  it('terminates the process tree and removes the abort listener on cancellation', async () => {
    const controller = new AbortController()
    const deferred = deferredExit()
    const terminate = vi.fn(async () => deferred.resolve(143))
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const port = createAgentProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => deferred.handle),
      terminate,
      writeStderr: vi.fn(),
    })

    const running = port.run({ argv: ['test-bin'], signal: controller.signal })
    controller.abort('SIGTERM')

    await expect(running).resolves.toEqual({
      error: { kind: 'cancelled', message: 'SIGTERM' },
      kind: 'failure',
    })
    expect(terminate).toHaveBeenCalledWith(deferred.handle)
    expect(removeListener).toHaveBeenCalled()
  })

  it('does not lose cancellation when the signal aborts synchronously during spawn', async () => {
    const controller = new AbortController()
    const deferred = deferredExit()
    const terminate = vi.fn(async () => deferred.resolve(143))
    const port = createAgentProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => {
        controller.abort('cancelled during spawn')
        return deferred.handle
      }),
      terminate,
      writeStderr: vi.fn(),
    })

    const outcome = await Promise.race([
      port.run({ argv: ['test-bin'], signal: controller.signal }),
      new Promise<'hung'>(resolve => setTimeout(() => resolve('hung'), 30)),
    ])

    expect(outcome).toEqual({
      error: { kind: 'cancelled', message: 'cancelled during spawn' },
      kind: 'failure',
    })
    expect(terminate).toHaveBeenCalledWith(deferred.handle)
  })

  it('accepts a normal exit that settles inside the timeout grace window', async () => {
    vi.useFakeTimers()
    const deferred = deferredExit()
    const terminate = vi.fn()
    const port = createAgentProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => deferred.handle),
      terminate,
      writeStderr: vi.fn(),
    })

    const running = port.run({ argv: ['test-bin'], signal: new AbortController().signal, timeoutMs: 20 })
    await vi.advanceTimersByTimeAsync(20)
    deferred.resolve(7)
    await vi.advanceTimersByTimeAsync(1)

    await expect(running).resolves.toEqual({ kind: 'success', value: { exitCode: 7 } })
    expect(terminate).not.toHaveBeenCalled()
  })

  it('terminates and returns timed-out after the grace window expires', async () => {
    vi.useFakeTimers()
    const deferred = deferredExit()
    const terminate = vi.fn(async () => deferred.resolve(143))
    const port = createAgentProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => deferred.handle),
      terminate,
      writeStderr: vi.fn(),
    })

    const running = port.run({ argv: ['test-bin'], signal: new AbortController().signal, timeoutMs: 20 })
    await vi.advanceTimersByTimeAsync(41)

    await expect(running).resolves.toEqual({
      error: { kind: 'timed-out', message: 'Agent process timed out after 20ms.' },
      kind: 'failure',
    })
    expect(terminate).toHaveBeenCalledWith(deferred.handle)
  })

  it('does not request a detached process group on Windows', async () => {
    const spawn = vi.fn(() => completedHandle(0))
    const port = createAgentProcessPort({ platform: 'win32', spawn, terminate: vi.fn(), writeStderr: vi.fn() })

    await port.run({ argv: ['test-bin'], signal: new AbortController().signal })

    expect(spawn).toHaveBeenCalledWith(['test-bin'], { detached: false, stdio: undefined })
  })
})

function completedHandle(exitCode: number, stdout = '', stderr = ''): SpawnedProcessHandle {
  return {
    exitCode,
    exited: Promise.resolve(exitCode),
    kill: vi.fn(),
    stderr: stderr as never,
    stdout: stdout as never,
    unref: vi.fn(),
  }
}

function deferredExit(): { handle: SpawnedProcessHandle; resolve: (exitCode: number) => void } {
  let exitCode: number | null = null
  let resolve!: (exitCode: number) => void
  const exited = new Promise<number>(complete => {
    resolve = value => {
      exitCode = value
      complete(value)
    }
  })
  const handle: SpawnedProcessHandle = {
    get exitCode() {
      return exitCode
    },
    exited,
    kill: vi.fn(),
    stderr: '' as never,
    stdout: '' as never,
    unref: vi.fn(),
  }
  return { handle, resolve }
}
