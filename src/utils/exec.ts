// KEEP (S1): published v1 execCommand helper. Thin CLI stdio wrapper, but
// compatibility root-exports it. Not a leftover pass-through to delete.
import { spawnWithQuantexStdio, waitForSpawnedCommand } from './cli-child-process'

export async function execCommand(command: string, args: string[]): Promise<{ success: boolean; exitCode: number }> {
  try {
    const handle = spawnWithQuantexStdio([command, ...args])
    const exitCode = await waitForSpawnedCommand(handle)
    return { success: exitCode === 0, exitCode }
  } catch {
    return { success: false, exitCode: 1 }
  }
}
