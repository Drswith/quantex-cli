export async function execCommand(command: string, args: string[]): Promise<{ success: boolean, exitCode: number }> {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return { success: proc.exitCode === 0, exitCode: proc.exitCode ?? 1 }
  }
  catch {
    return { success: false, exitCode: 1 }
  }
}
