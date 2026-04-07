export async function install(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['npm', 'i', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function update(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['npm', 'update', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}

export async function uninstall(packageName: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['npm', 'uninstall', '-g', packageName], {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    })
    await proc.exited
    return proc.exitCode === 0
  }
  catch {
    return false
  }
}
