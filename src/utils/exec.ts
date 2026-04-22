import { spawnWithQuantexStdio, waitForSpawnedCommand } from './child-process'

export async function execCommand(command: string, args: string[]): Promise<{ success: boolean, exitCode: number }> {
  try {
    const handle = spawnWithQuantexStdio([command, ...args])
    const exitCode = await waitForSpawnedCommand(handle)
    return { success: exitCode === 0, exitCode }
  }
  catch {
    return { success: false, exitCode: 1 }
  }
}
