import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

interface BunStyleMockProcess {
  exitCode: number | null
  exited: Promise<unknown>
  kill?: (signal?: NodeJS.Signals | number) => boolean
  pid?: number
  stderr?: unknown
  stdout?: unknown
  unref?: () => void
}

type BunStyleSpawnMock = (command: string[], options: unknown) => BunStyleMockProcess

export function createCrossSpawnMock(spawn: BunStyleSpawnMock): typeof import('cross-spawn') {
  return ((file: string, args: readonly string[] = [], options: unknown = {}) => {
    const proc = spawn([file, ...args], options)
    const child = new EventEmitter() as ChildProcess

    Object.defineProperties(child, {
      exitCode: { configurable: true, get: () => proc.exitCode },
      pid: { configurable: true, get: () => proc.pid },
      stderr: { configurable: true, get: () => proc.stderr },
      stdout: { configurable: true, get: () => proc.stdout },
    })
    child.kill = signal => proc.kill?.(signal) ?? true
    child.unref = () => {
      proc.unref?.()
      return child
    }

    void proc.exited.then(
      () => child.emit('close', proc.exitCode ?? 1),
      error => child.emit('error', error),
    )
    return child
  }) as typeof import('cross-spawn')
}
