import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelCliContextOperations, setCliContext } from '../../src/cli-context'
import {
  readProcessOutputWithContext,
  readProcessOutput,
  shouldUseCrossSpawnOnWindows,
  spawnCommand,
  spawnWithQuantexStdio,
  terminateWindowsProcessTree,
  waitForSpawnedCommand,
} from '../../src/utils/child-process'

const mockSpawn = vi.fn()
const crossSpawnOverride = vi.hoisted(() => vi.fn())
let originalSpawn: typeof Bun.spawn

vi.mock('cross-spawn', async importOriginal => {
  const actual = await importOriginal<unknown>()
  const actualSpawn = (actual as { default: typeof import('cross-spawn') }).default
  const { createCrossSpawnMock } = await import('../helpers/cross-spawn-mock')
  const adaptedOverride = createCrossSpawnMock(crossSpawnOverride)
  return {
    default: (...args: Parameters<typeof actualSpawn>) =>
      crossSpawnOverride.getMockImplementation() ? adaptedOverride(...args) : actualSpawn(...args),
  }
})

describe('Windows shim selection', () => {
  it('routes extensionless PATH commands and explicit command shims through cross-spawn', () => {
    expect(shouldUseCrossSpawnOnWindows('npm', 'win32')).toBe(true)
    expect(shouldUseCrossSpawnOnWindows('npm.cmd', 'win32')).toBe(true)
    expect(shouldUseCrossSpawnOnWindows('C:\\tools\\npm.cmd', 'win32')).toBe(true)
    expect(shouldUseCrossSpawnOnWindows('npm.exe', 'win32')).toBe(false)
    expect(shouldUseCrossSpawnOnWindows('npm', 'linux')).toBe(false)
  })

  it.skipIf(process.platform !== 'win32')('preserves metacharacter arguments without executing them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantex-windows-shim-'))
    const capture = join(root, 'capture.cjs')
    const shim = join(root, 'capture.cmd')
    const output = join(root, 'args.json')
    const injected = join(root, 'injected.txt')
    const args = ['with space', '&', '|', '>', '^', '(value)', '"quoted"', `& echo injected > "${injected}"`]
    try {
      await writeFile(
        capture,
        `require('node:fs').writeFileSync(${JSON.stringify(output)}, JSON.stringify(process.argv.slice(2)))\n`,
      )
      await writeFile(shim, '@echo off\r\nnode "%~dp0capture.cjs" %*\r\n')
      const result = await readProcessOutput(spawnCommand([shim, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }))

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(args)
      expect(existsSync(injected)).toBe(false)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})

describe('spawnWithQuantexStdio', () => {
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalSpawn = Bun.spawn
    Bun.spawn = mockSpawn as any
    crossSpawnOverride.mockImplementation(mockSpawn)
    stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    Bun.spawn = originalSpawn
    stderrWriteSpy.mockRestore()
    mockSpawn.mockReset()
    crossSpawnOverride.mockReset()
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
