import { spawn, type ChildProcess, type SpawnOptions as NodeSpawnOptions } from 'node:child_process'
import process from 'node:process'
import { text as readText } from 'node:stream/consumers'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'

export type SpawnCommand = readonly string[]
type SpawnStdio = 'ignore' | 'inherit' | 'pipe'
type SpawnOptions = Omit<NodeSpawnOptions, 'stdio'> & {
  stdio?: [SpawnStdio, SpawnStdio, SpawnStdio]
}

interface BunSpawnLike {
  exitCode: number | null
  exited: Promise<unknown>
  kill?: (signal?: NodeJS.Signals | number) => boolean
  stderr?: unknown
  stdout?: unknown
  unref?: () => void
}

export interface SpawnedProcessHandle {
  readonly exitCode: number | null
  readonly stderr: ChildProcess['stderr']
  readonly stdout: ChildProcess['stdout']
  exited: Promise<number>
  kill: ChildProcess['kill']
  unref: () => void
}

export interface SpawnHandle {
  cleanup: () => void
  outputDrained: Promise<void>
  proc: SpawnedProcessHandle
}

export function spawnWithQuantexStdio(command: SpawnCommand, options: SpawnOptions = {}): SpawnHandle {
  if (getCliContext().outputMode === 'human') {
    const proc = spawnCommand(command, {
      ...options,
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    return {
      cleanup: registerCliCancellationHandler(() => proc.kill?.('SIGTERM')),
      outputDrained: Promise.resolve(),
      proc,
    }
  }

  const proc = spawnCommand(command, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  })

  return {
    cleanup: registerCliCancellationHandler(() => proc.kill?.('SIGTERM')),
    outputDrained: Promise.all([forwardToStderr(proc.stdout), forwardToStderr(proc.stderr)]).then(() => undefined),
    proc,
  }
}

export async function waitForSpawnedCommand(handle: SpawnHandle): Promise<number> {
  try {
    const exitCode = await handle.proc.exited
    await handle.outputDrained
    return exitCode
  } finally {
    handle.cleanup()
  }
}

export function spawnCommand(command: SpawnCommand, options: SpawnOptions = {}): SpawnedProcessHandle {
  const bunSpawn = getBunSpawn()
  if (bunSpawn) return spawnWithBun(command, options, bunSpawn)

  const [file, ...args] = command
  if (!file) {
    throw new Error('spawnCommand requires a non-empty command array.')
  }
  const child = spawn(file, args, {
    ...options,
    shell: options.shell ?? shouldUseShellOnWindows(file),
  })

  return {
    get exitCode() {
      return child.exitCode
    },
    stderr: child.stderr,
    stdout: child.stdout,
    exited: waitForChildProcess(child),
    kill: child.kill.bind(child),
    unref: () => child.unref(),
  }
}

export async function readProcessOutput(proc: SpawnedProcessHandle): Promise<{
  exitCode: number
  stderr: string
  stdout: string
}> {
  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout),
    readStreamText(proc.stderr),
    proc.exited,
  ])

  return {
    exitCode,
    stderr,
    stdout,
  }
}

async function forwardToStderr(stream: unknown): Promise<void> {
  if (!stream) return

  const output = await readStreamText(stream as NodeJS.ReadableStream)
  if (output) process.stderr.write(output)
}

async function waitForChildProcess(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', code => {
      resolve(typeof code === 'number' ? code : 1)
    })
  })
}

async function readStreamText(stream: unknown): Promise<string> {
  if (!stream) return ''
  if (typeof stream === 'string') return stream
  if (typeof (stream as { getReader?: unknown }).getReader === 'function') {
    return new Response(stream as unknown as ReadableStream).text()
  }
  return readText(stream as NodeJS.ReadableStream)
}

function shouldUseShellOnWindows(file: string): boolean {
  if (process.platform !== 'win32') return false
  if (file.includes('/') || file.includes('\\')) return false
  return !/\.[a-z0-9]+$/i.test(file)
}

function getBunSpawn(): ((command: string[], options?: SpawnOptions) => BunSpawnLike) | undefined {
  const candidate = (globalThis as { Bun?: { spawn?: unknown } }).Bun?.spawn
  return typeof candidate === 'function'
    ? (candidate as (command: string[], options?: SpawnOptions) => BunSpawnLike)
    : undefined
}

function spawnWithBun(
  command: SpawnCommand,
  options: SpawnOptions,
  bunSpawn: (command: string[], options?: SpawnOptions) => BunSpawnLike,
): SpawnedProcessHandle {
  const proc = bunSpawn([...command], options)

  return {
    get exitCode() {
      return proc.exitCode
    },
    stderr: proc.stderr as ChildProcess['stderr'],
    stdout: proc.stdout as ChildProcess['stdout'],
    exited: proc.exited.then(() => (typeof proc.exitCode === 'number' ? proc.exitCode : 1)),
    kill: signal => proc.kill?.(signal) ?? false,
    unref: () => proc.unref?.(),
  }
}
