import crossSpawn from 'cross-spawn'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import process from 'node:process'

export interface ReadOnlyCommandContext {
  readonly registerCleanup?: (cleanup: {
    cleanup(): Promise<void> | void
    force?(): Promise<void> | void
  }) => () => void
  readonly signal: AbortSignal
}

export interface ReadOnlyCommandResult {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

export class CoreProcessInterruptionError extends Error {
  readonly kind = 'cancelled' as const

  constructor(readonly reason?: string) {
    super('Core read-only process was cancelled.')
    this.name = 'CoreProcessInterruptionError'
  }
}

export async function runReadOnlyCommand(
  argv: readonly string[],
  context: ReadOnlyCommandContext,
): Promise<ReadOnlyCommandResult> {
  if (context.signal.aborted) throw new CoreProcessInterruptionError(abortReason(context.signal))
  const [file, ...args] = argv
  if (!file) throw new Error('A read-only command requires a non-empty argv array.')

  const child = crossSpawn(file, args, {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  child.stdout?.on('data', chunk => stdout.push(Buffer.from(chunk)))
  child.stderr?.on('data', chunk => stderr.push(Buffer.from(chunk)))

  let interrupted = false
  let cleanupPromise: Promise<void> | undefined
  let forcePromise: Promise<void> | undefined
  const cleanup = (): Promise<void> => (cleanupPromise ??= terminateReadOnlyProcess(child))
  const force = (): Promise<void> => (forcePromise ??= forceTerminateReadOnlyProcess(child))
  const unregisterCleanup = context.registerCleanup?.({ cleanup, force })
  let interrupt!: () => void
  const cancellation = new Promise<never>((_resolve, reject) => {
    interrupt = () => {
      if (interrupted) return
      interrupted = true
      void cleanup().then(() => reject(new CoreProcessInterruptionError(abortReason(context.signal))))
    }
    context.signal.addEventListener('abort', interrupt, { once: true })
    if (context.signal.aborted) interrupt()
  })
  const completion = new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', code => resolve(typeof code === 'number' ? code : 1))
  }).then(exitCode => (interrupted ? cancellation : exitCode))

  try {
    const exitCode = await Promise.race([completion, cancellation])
    return {
      exitCode,
      stderr: Buffer.concat(stderr).toString('utf8'),
      stdout: Buffer.concat(stdout).toString('utf8'),
    }
  } finally {
    context.signal.removeEventListener('abort', interrupt)
    unregisterCleanup?.()
  }
}

async function terminateReadOnlyProcess(child: ChildProcess): Promise<void> {
  if (process.platform === 'win32' && child.pid !== undefined) {
    await terminateWindowsTree(child.pid, spawn, 100)
  }

  signalTree(child, 'SIGTERM')
  if (await exitsWithin(child, 100)) return
  signalTree(child, 'SIGKILL')
  await exitsWithin(child, 250)
}

async function forceTerminateReadOnlyProcess(child: ChildProcess): Promise<void> {
  if (process.platform === 'win32' && child.pid !== undefined) {
    await terminateWindowsTree(child.pid, spawn, 100)
  }
  signalTree(child, 'SIGKILL')
  await exitsWithin(child, 250)
}

function signalTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall through when the process is not a process-group leader.
    }
  }

  try {
    child.kill(signal)
  } catch {
    // Best-effort cleanup for a process that already exited.
  }
}

export async function terminateWindowsTree(
  pid: number,
  spawnProcess: typeof spawn = spawn,
  deadlineMs = 100,
): Promise<boolean> {
  const killer = spawnProcess('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true,
  })
  let deadline: ReturnType<typeof setTimeout> | undefined
  const completed = once(killer, 'close').then(
    () => true,
    () => false,
  )
  const timedOut = new Promise<false>(resolve => {
    deadline = setTimeout(() => resolve(false), deadlineMs)
  })
  const result = await Promise.race([completed, timedOut])
  if (deadline) clearTimeout(deadline)
  if (result) return true

  try {
    killer.kill('SIGKILL')
  } catch {
    // Continue with direct child termination when taskkill itself cannot be stopped.
  }
  return false
}

async function exitsWithin(child: ChildProcess, durationMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      new Promise<true>(resolve => child.once('close', () => resolve(true))),
      new Promise<false>(resolve => {
        timer = setTimeout(() => resolve(false), durationMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function abortReason(signal: AbortSignal): string | undefined {
  if (signal.reason === undefined) return undefined
  return signal.reason instanceof Error ? signal.reason.message : String(signal.reason)
}
