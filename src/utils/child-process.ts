import process from 'node:process'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'

type SpawnCommand = Parameters<typeof Bun.spawn>[0]
type SpawnOptions = Exclude<Parameters<typeof Bun.spawn>[1], undefined>

export interface SpawnHandle {
  cleanup: () => void
  outputDrained: Promise<void>
  proc: ReturnType<typeof Bun.spawn>
}

export function spawnWithQuantexStdio(command: SpawnCommand, options: SpawnOptions = {}): SpawnHandle {
  if (getCliContext().outputMode === 'human') {
    const proc = Bun.spawn(command, {
      ...options,
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    return {
      cleanup: registerCliCancellationHandler(() => proc.kill?.('SIGTERM')),
      outputDrained: Promise.resolve(),
      proc,
    }
  }

  const proc = Bun.spawn(command, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  })

  return {
    cleanup: registerCliCancellationHandler(() => proc.kill?.('SIGTERM')),
    outputDrained: Promise.all([
      forwardToStderr(proc.stdout),
      forwardToStderr(proc.stderr),
    ]).then(() => {}),
    proc,
  }
}

export async function waitForSpawnedCommand(handle: SpawnHandle): Promise<number> {
  try {
    await handle.proc.exited
    await handle.outputDrained
    return handle.proc.exitCode ?? 1
  }
  finally {
    handle.cleanup()
  }
}

async function forwardToStderr(stream: unknown): Promise<void> {
  if (!stream)
    return

  const output = await new Response(stream as any).text()
  if (output)
    process.stderr.write(output)
}
