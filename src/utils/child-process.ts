import type { ProviderOperationContext } from '../providers'
import { spawn, type ChildProcess, type SpawnOptions as NodeSpawnOptions } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'
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
  pid?: number
  stderr?: unknown
  stdout?: unknown
  unref?: () => void
}

export interface SpawnedProcessHandle {
  readonly exitCode: number | null
  readonly pid?: number
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

export class ProcessInterruptionError extends Error {
  readonly kind: 'cancelled' | 'timed-out'
  readonly reason?: string
  readonly timeoutMs?: number

  constructor(input: { kind: 'cancelled'; reason?: string } | { kind: 'timed-out'; timeoutMs: number }) {
    super(input.kind === 'timed-out' ? `Process timed out after ${input.timeoutMs}ms.` : 'Process was cancelled.')
    this.name = 'ProcessInterruptionError'
    this.kind = input.kind
    if (input.kind === 'timed-out') this.timeoutMs = input.timeoutMs
    else this.reason = input.reason
  }
}

export function isProcessInterruptionError(error: unknown): error is ProcessInterruptionError {
  return error instanceof ProcessInterruptionError
}

export function spawnWithQuantexStdio(command: SpawnCommand, options: SpawnOptions = {}): SpawnHandle {
  if (getCliContext().outputMode === 'human') {
    const proc = spawnCommand(command, {
      ...options,
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    return {
      cleanup: registerCliCancellationHandler(() => terminateManagedProcess(proc)),
      outputDrained: Promise.resolve(),
      proc,
    }
  }

  const proc = spawnCommand(command, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  })

  return {
    cleanup: registerCliCancellationHandler(() => terminateManagedProcess(proc)),
    outputDrained: Promise.all([forwardToStderr(proc.stdout), forwardToStderr(proc.stderr)]).then(() => undefined),
    proc,
  }
}

export async function waitForSpawnedCommand(handle: SpawnHandle): Promise<number> {
  const context = getCliContext()
  try {
    const exitCode = await handle.proc.exited
    await handle.outputDrained
    if (context.cancelled) return 1
    return exitCode
  } finally {
    handle.cleanup()
  }
}

export function spawnCommand(command: SpawnCommand, options: SpawnOptions = {}): SpawnedProcessHandle {
  const bunSpawn = options.detached ? undefined : getBunSpawn()
  if (bunSpawn) return spawnWithBun(command, options, bunSpawn)

  const [requestedFile, ...args] = command
  const file = requestedFile ? resolveDetachedExecutable(requestedFile, options) : undefined
  if (!file) {
    throw new Error('spawnCommand requires a non-empty command array.')
  }
  const child = spawn(file, args, {
    ...options,
    env: options.env ?? process.env,
    shell: options.shell ?? shouldUseShellOnWindows(file),
  })

  return {
    get exitCode() {
      return child.exitCode
    },
    pid: child.pid,
    stderr: child.stderr,
    stdout: child.stdout,
    exited: waitForChildProcess(child),
    kill: child.kill.bind(child),
    unref: () => child.unref(),
  }
}

function resolveDetachedExecutable(file: string, options: SpawnOptions): string {
  if (!options.detached || process.platform === 'win32' || file.includes('/')) return file
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, file)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Continue through PATH.
    }
  }
  return file
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

export async function readProcessOutputWithContext(
  proc: SpawnedProcessHandle,
  context: ProviderOperationContext,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let cleanupPromise: Promise<void> | undefined
  const cleanup = (): Promise<void> => (cleanupPromise ??= terminateProcessTree(proc, context.timeoutMs))
  const unregisterCleanup = context.registerCleanup?.({
    cleanup,
    force: () => forceTerminateProcessTree(proc),
  })
  if (context.signal.aborted) {
    await cleanup()
    unregisterCleanup?.()
    throw new ProcessInterruptionError({ kind: 'cancelled', reason: abortReason(context.signal) })
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  let cancel!: () => void
  let interrupt!: (kind: 'cancelled' | 'timed-out') => void
  let interrupted = false
  const interruption = new Promise<never>((_resolve, reject) => {
    interrupt = kind => {
      if (interrupted) return
      interrupted = true
      void cleanup().then(() =>
        setTimeout(
          () =>
            reject(
              kind === 'timed-out'
                ? new ProcessInterruptionError({ kind, timeoutMs: context.timeoutMs! })
                : new ProcessInterruptionError({ kind, reason: abortReason(context.signal) }),
            ),
          10,
        ),
      )
    }
    cancel = () => interrupt('cancelled')
    context.signal.addEventListener('abort', cancel, { once: true })
    if (context.timeoutMs !== undefined) timeout = setTimeout(() => interrupt('timed-out'), context.timeoutMs)
  })

  try {
    const output = readProcessOutput(proc).then(result => (interrupted ? interruption : result))
    return await Promise.race([output, interruption])
  } finally {
    if (timeout) clearTimeout(timeout)
    context.signal.removeEventListener('abort', cancel)
    unregisterCleanup?.()
  }
}

function abortReason(signal: AbortSignal): string | undefined {
  if (typeof signal.reason === 'string') return signal.reason
  if (signal.reason instanceof Error) return signal.reason.message
  return signal.reason === undefined ? undefined : String(signal.reason)
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
    pid: proc.pid,
    stderr: proc.stderr as ChildProcess['stderr'],
    stdout: proc.stdout as ChildProcess['stdout'],
    exited: proc.exited.then(() => (typeof proc.exitCode === 'number' ? proc.exitCode : 1)),
    kill: signal => proc.kill?.(signal) ?? false,
    unref: () => proc.unref?.(),
  }
}

async function terminateManagedProcess(proc: SpawnedProcessHandle): Promise<void> {
  await terminateProcessTree(proc)
}

export async function terminateProcessTree(proc: SpawnedProcessHandle, requestedGraceMs?: number): Promise<void> {
  if (process.platform === 'win32' && proc.pid !== undefined)
    await runWithDeadline(terminateWindowsProcessTree(proc.pid), 2_000)

  signalProcessTree(proc, 'SIGTERM')

  const exited = proc.exited.then(() => true).catch(() => true)
  const graceMs = requestedGraceMs === undefined ? 2_000 : Math.max(10, Math.min(requestedGraceMs, 250))
  const exitedDuringGrace = await Promise.race([
    exited,
    new Promise<false>(resolve => setTimeout(() => resolve(false), graceMs)),
  ])
  if (exitedDuringGrace) return

  signalProcessTree(proc, 'SIGKILL')
  await runWithDeadline(
    proc.exited.then(() => undefined).catch(() => undefined),
    250,
  )
}

export async function forceTerminateProcessTree(proc: SpawnedProcessHandle): Promise<void> {
  if (process.platform === 'win32' && proc.pid !== undefined)
    await runWithDeadline(terminateWindowsProcessTree(proc.pid), 250)
  signalProcessTree(proc, 'SIGKILL')
  await runWithDeadline(
    proc.exited.then(() => undefined).catch(() => undefined),
    250,
  )
}

function signalProcessTree(proc: SpawnedProcessHandle, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && proc.pid !== undefined) {
    try {
      process.kill(-proc.pid, signal)
      return
    } catch {
      // Fall through when the child is not a process-group leader.
    }
  }

  try {
    proc.kill?.(signal)
  } catch {
    // Best-effort termination.
  }
}

export async function terminateWindowsProcessTree(pid: number, spawnProcess: typeof spawn = spawn): Promise<void> {
  await new Promise<void>(resolve => {
    const killer = spawnProcess('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    })
    killer.once('error', () => resolve())
    killer.once('close', () => resolve())
  })
}

async function runWithDeadline(work: Promise<void>, timeoutMs: number): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    await Promise.race([
      work,
      new Promise<void>(resolve => {
        timeoutId = setTimeout(resolve, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
