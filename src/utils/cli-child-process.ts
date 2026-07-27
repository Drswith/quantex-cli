import type { SpawnCommand, SpawnHandle, SpawnOptions } from './child-process'
import { getCliContext, registerCliCancellationHandler } from '../cli-context'
import { resolveCliProviderOutputPolicy } from '../runtime/cli-operation-context'
import { spawnWithOutputPolicy, terminateProcessTree } from './child-process'

export function spawnWithQuantexStdio(command: SpawnCommand, options: SpawnOptions = {}): SpawnHandle {
  const handle = spawnWithOutputPolicy(command, resolveCliProviderOutputPolicy(getCliContext().outputMode), options)
  const unregisterCancellation = registerCliCancellationHandler(() => terminateProcessTree(handle.proc))

  return {
    ...handle,
    cleanup: () => {
      unregisterCancellation()
      handle.cleanup()
    },
  }
}

export async function waitForSpawnedCommand(handle: SpawnHandle): Promise<number> {
  const context = getCliContext()
  try {
    const exitCode = await handle.proc.exited
    await handle.outputDrained
    return context.cancelled ? 1 : exitCode
  } finally {
    handle.cleanup()
  }
}
