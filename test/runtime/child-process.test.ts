import type { SpawnedProcessHandle } from '../../src/utils/child-process'
import { describe, expect, it, vi } from 'vitest'
import { createChildProcessPort } from '../../src/runtime/child-process'

describe('createChildProcessPort', () => {
  it('captures piped output without forwarding it to a presentation stream', async () => {
    const spawn = vi.fn(() => completedHandle(0, '1.2.3\n', 'warning\n'))
    const writeStderr = vi.fn()
    const port = createChildProcessPort({ platform: 'linux', spawn, terminate: vi.fn(), writeStderr })

    await expect(
      port.run({
        argv: ['qtx', '--version'],
        signal: new AbortController().signal,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).resolves.toEqual({
      kind: 'success',
      value: {
        exitCode: 0,
        stderr: new TextEncoder().encode('warning\n'),
        stdout: new TextEncoder().encode('1.2.3\n'),
      },
    })
    expect(spawn).toHaveBeenCalledWith(['qtx', '--version'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(writeStderr).not.toHaveBeenCalled()
  })

  it('forwards explicitly requested piped diagnostics to stderr', async () => {
    const writeStderr = vi.fn()
    const port = createChildProcessPort({
      platform: 'linux',
      spawn: vi.fn(() => completedHandle(1, 'install progress\n', 'install failed\n')),
      terminate: vi.fn(),
      writeStderr,
    })

    await port.run({
      argv: ['npm', 'install', '-g', 'quantex-cli'],
      forwardPipedOutput: true,
      signal: new AbortController().signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    expect(writeStderr.mock.calls.map(([value]) => value)).toEqual(['install progress\n', 'install failed\n'])
  })

  it('terminates the child when cancellation wins', async () => {
    const controller = new AbortController()
    const child = deferredHandle()
    const terminate = vi.fn(async () => child.resolve(143))
    const port = createChildProcessPort({ platform: 'linux', spawn: vi.fn(() => child.handle), terminate })

    const running = port.run({ argv: ['npm', 'install'], signal: controller.signal })
    controller.abort('cancelled install')

    await expect(running).resolves.toEqual({
      error: { kind: 'cancelled', message: 'cancelled install' },
      kind: 'failure',
    })
    expect(terminate).toHaveBeenCalledWith(child.handle)
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

function deferredHandle(): { handle: SpawnedProcessHandle; resolve(exitCode: number): void } {
  let exitCode: number | null = null
  let resolve!: (value: number) => void
  const exited = new Promise<number>(complete => {
    resolve = value => {
      exitCode = value
      complete(value)
    }
  })
  return {
    handle: {
      get exitCode() {
        return exitCode
      },
      exited,
      kill: vi.fn(),
      stderr: '' as never,
      stdout: '' as never,
      unref: vi.fn(),
    },
    resolve,
  }
}
